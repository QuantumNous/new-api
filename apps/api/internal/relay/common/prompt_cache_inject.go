package common

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/tidwall/gjson"
)

// Upstream prompt caching is a pure prefix cache: Anthropic bills explicit
// cache writes (1.25x for 5m TTL, 2x for 1h) and discounts reads, OpenAI
// caches prefixes automatically and only offers prompt_cache_key to improve
// its server-side routing. Both knobs are useless when the gateway rotates
// upstream accounts per request, so they are wired to channel-scoped switches
// that admins enable on stable, cache-friendly channels.

// autoCacheControlTTL sizes the repeat-seen marker between consecutive turns
// of one conversation. Anthropic's default cache TTL is 5 minutes and every
// cache read refreshes it server-side, so a marker of the same length keeps
// the injection active for interactive sessions without ever being the reason
// a write is paid twice.
const autoCacheControlTTL = 300 * time.Second

// anthropicMinCacheTokens is the shortest cacheable prefix Anthropic accepts
// (sonnet/opus tier; haiku is 2048). Below this a cache_control breakpoint is
// rejected outright, so injection only ever applies to clearly long prefixes.
const anthropicMinCacheTokens = 1024

// roughTokenFloorEstimate is a conservative chars-per-token divisor. System
// prompts are English-heavy instructions where ~4 chars/token is typical;
// dividing by 3 only underestimates the token count for CJK-heavy prefixes,
// where the same text is denser in tokens anyway, so the gate never fires on
// a prefix too short to be cacheable.
const roughTokenFloorEstimate = 3

// UndoPromptCache reverts one automatic cache injection. A non-nil value
// means the injection happened and the attempt carries a marker the client
// never sent; the send path can hand it to FallbackPromptCacheAfterRejection
// if the upstream rejects that marker.
type UndoPromptCache func()

// Marker field names, used to match an upstream rejection to the injection
// that caused it.
const (
	PromptCacheFieldCacheControl   = "cache_control"
	PromptCacheFieldPromptCacheKey = "prompt_cache_key"
)

// MaybeInjectClaudeCacheControl adds one ephemeral breakpoint to the end of the
// cacheable system+tools prefix when the channel enables the feature and the
// client did not mark the request itself. The marker gate ("seen before")
// keeps the write surcharge from being spent on prefixes that never repeat.
func MaybeInjectClaudeCacheControl(c contract.Context, info *RelayInfo, request *dto.ClaudeRequest) UndoPromptCache {
	if c == nil || info == nil || request == nil || !info.HasChannelMeta() {
		return nil
	}
	if !info.ChannelOtherSettings.AutoPromptCacheControl || promptCacheSuppressed(c) {
		return nil
	}
	if requestHasClaudeCacheControl(request) {
		// The user controls breakpoints; any marker left by an earlier
		// auto-injected turn must not keep re-injecting alongside user marks.
		ClearCachePrefixSeen(resolveAffinityKey(c, info), info.ChannelId)
		return nil
	}
	prefixText := claudeCacheablePrefixText(request)
	if len(prefixText)/roughTokenFloorEstimate < anthropicMinCacheTokens {
		return nil
	}
	if promptCacheRejected(info.ChannelId) {
		return nil
	}
	affinityKey := resolveAffinityKey(c, info)
	if !CachePrefixSeenBefore(affinityKey, info.ChannelId) {
		return nil
	}

	mark := json.RawMessage(`{"type":"ephemeral"}`)
	if systemText, ok := request.System.(string); ok && systemText != "" {
		// Anthropic accepts cache_control only on block form, so normalize the
		// equivalent plain-string system prompt into a single text block
		// instead of silently skipping the most common request shape.
		request.System = []dto.ClaudeMediaMessage{{Type: dto.ContentTypeText, Text: &systemText, CacheControl: mark}}
		markCachePrefixSeen(affinityKey, info.ChannelId)
		return func() { request.System = systemText }
	}
	var undo UndoPromptCache
	if systemBlocks, ok := request.System.([]dto.ClaudeMediaMessage); ok && len(systemBlocks) > 0 {
		last := &systemBlocks[len(systemBlocks)-1]
		previous := last.CacheControl
		last.CacheControl = mark
		request.System = systemBlocks
		undo = func() { last.CacheControl = previous }
	} else if systemBlocksAny, ok := request.System.([]any); ok && len(systemBlocksAny) > 0 {
		// A body that failed strict DTO unmarshalling can still carry the
		// system blocks as generic JSON objects (ClaudeRequestBodyOverride).
		lastBlock, ok := systemBlocksAny[len(systemBlocksAny)-1].(map[string]any)
		if !ok {
			return nil
		}
		lastBlock["cache_control"] = map[string]string{"type": "ephemeral"}
		// requestHasClaudeCacheControl above guarantees no prior mark here.
		undo = func() { delete(lastBlock, "cache_control") }
	} else {
		// No cacheable system content; a messages-only prefix is volatile and
		// caching it would only pay the write surcharge.
		return nil
	}

	markCachePrefixSeen(affinityKey, info.ChannelId)
	return undo
}

// requestHasClaudeCacheControl reports whether the client already marked any
// cacheable position (top-level automatic mode, system blocks, or message
// parts). Once the user controls breakpoints the gateway stays out of it.
func requestHasClaudeCacheControl(request *dto.ClaudeRequest) bool {
	if len(request.CacheControl) > 0 {
		return true
	}
	if systemBlocks, ok := parseClaudeSystemBlocks(request.System); ok {
		for _, block := range systemBlocks {
			if len(block.CacheControl) > 0 {
				return true
			}
		}
	}
	for _, message := range request.Messages {
		if messageHasCacheControl(message.Content) {
			return true
		}
	}
	return false
}

func messageHasCacheControl(content any) bool {
	switch blocks := content.(type) {
	case []dto.ClaudeMediaMessage:
		for _, block := range blocks {
			if len(block.CacheControl) > 0 {
				return true
			}
		}
	case []*dto.ClaudeMediaMessage:
		for _, block := range blocks {
			if block != nil && len(block.CacheControl) > 0 {
				return true
			}
		}
	case []any:
		for _, entry := range blocks {
			if part, ok := entry.(map[string]any); ok {
				if _, marked := part["cache_control"]; marked {
					return true
				}
			}
		}
	}
	return false
}

// parseClaudeSystemBlocks returns the system blocks for every shape the
// relay accepts in a system field (parsed blocks or generic JSON decoded from
// a loosely-parsed body). The bool is false when the system is plain text.
func parseClaudeSystemBlocks(system any) ([]dto.ClaudeMediaMessage, bool) {
	switch sys := system.(type) {
	case []dto.ClaudeMediaMessage:
		return sys, true
	case []any:
		blocks := make([]dto.ClaudeMediaMessage, 0, len(sys))
		for _, entry := range sys {
			block, ok := entry.(dto.ClaudeMediaMessage)
			if !ok {
				// Generic map blocks: only used to detect existing marks.
				if part, isMap := entry.(map[string]any); isMap {
					if _, marked := part["cache_control"]; marked {
						return []dto.ClaudeMediaMessage{{CacheControl: json.RawMessage("{}")}}, true
					}
				}
				continue
			}
			blocks = append(blocks, block)
		}
		return blocks, true
	}
	return nil, false
}

// claudeCacheablePrefixText concatenates the text of the stable cacheable
// prefix (system prompt plus tool definitions) for the length gate.
func claudeCacheablePrefixText(request *dto.ClaudeRequest) string {
	var sb strings.Builder
	switch sys := request.System.(type) {
	case string:
		sb.WriteString(sys)
	case []any:
		for _, entry := range sys {
			if part, ok := entry.(map[string]any); ok {
				if text, isString := part["text"].(string); isString {
					sb.WriteString(text)
				}
			} else if block, ok := entry.(dto.ClaudeMediaMessage); ok {
				sb.WriteString(block.GetText())
			}
		}
	default:
		if blocks, ok := request.System.([]dto.ClaudeMediaMessage); ok {
			for _, block := range blocks {
				sb.WriteString(block.GetText())
			}
		}
	}
	if toolsText := claudeToolsText(request.Tools); toolsText != "" {
		sb.WriteString(toolsText)
	}
	return sb.String()
}

func claudeToolsText(tools any) string {
	switch typed := tools.(type) {
	case nil:
		return ""
	case json.RawMessage:
		if len(typed) == 0 || string(typed) == "null" {
			return ""
		}
	case *json.RawMessage:
		if typed == nil || len(*typed) == 0 || string(*typed) == "null" {
			return ""
		}
	}
	// Parsed requests keep tools either as raw JSON or as decoded generic
	// values; marshalling back to JSON lets gjson cover both shapes.
	raw, err := common.Marshal(tools)
	if err != nil || len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var sb strings.Builder
	gjson.GetBytes(raw, "@this").ForEach(func(_, tool gjson.Result) bool {
		if name := tool.Get("name").String(); name != "" {
			sb.WriteString(name)
		}
		if desc := tool.Get("description").String(); desc != "" {
			sb.WriteString(desc)
		}
		return true
	})
	return sb.String()
}

// MaybeInjectOpenAIChatCacheKey injects prompt_cache_key into a converted
// chat request. Requests converted to other upstream formats carry no
// OpenAI-specific field, so a non-chat conversion is left untouched.
func MaybeInjectOpenAIChatCacheKey(c contract.Context, info *RelayInfo, convertedRequest any) UndoPromptCache {
	if openAIRequest, ok := convertedRequest.(*dto.GeneralOpenAIRequest); ok {
		return MaybeInjectOpenAIPromptCacheKey(c, info, openAIRequest)
	}
	return nil
}

// MaybeInjectOpenAIPromptCacheKey sets a derived prompt_cache_key on OpenAI
// chat requests when the channel enables it and the client sent none. The key
// is the same stable prefix hash the affinity router uses, which is what
// OpenAI's cache routing wants (a per-conversation boundary, not a user one).
// A user-supplied key is never overwritten.
func MaybeInjectOpenAIPromptCacheKey(c contract.Context, info *RelayInfo, request *dto.GeneralOpenAIRequest) UndoPromptCache {
	if c == nil || info == nil || request == nil || !info.HasChannelMeta() {
		return nil
	}
	if !info.ChannelOtherSettings.AutoPromptCacheKey || promptCacheSuppressed(c) {
		return nil
	}
	if strings.TrimSpace(request.PromptCacheKey) != "" {
		return nil
	}
	if promptCacheRejected(info.ChannelId) {
		return nil
	}
	key := resolveAffinityKey(c, info)
	if key == "" || !isSafePromptCacheKey(key) {
		// The key goes verbatim to OpenAI, which caps it at 64
		// alphanumeric/-/_ characters. A client-declared session boundary
		// outside that contract would be rejected by every upstream request
		// (and trip the rejection blacklist), so inject nothing instead of
		// poisoning the channel over one client's field.
		return nil
	}
	previous := request.PromptCacheKey
	request.PromptCacheKey = key
	return func() { request.PromptCacheKey = previous }
}

// isSafePromptCacheKey reports whether key satisfies OpenAI's documented
// prompt_cache_key contract (1-64 chars of [A-Za-z0-9_-]), which derived
// ses_-hash keys always satisfy.
func isSafePromptCacheKey(key string) bool {
	if len(key) == 0 || len(key) > 64 {
		return false
	}
	for _, char := range key {
		switch {
		case char >= 'a' && char <= 'z', char >= 'A' && char <= 'Z', char >= '0' && char <= '9', char == '-', char == '_':
		default:
			return false
		}
	}
	return true
}
