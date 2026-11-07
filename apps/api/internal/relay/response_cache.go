package relay

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/internal/billing"
	model_setting "github.com/QuantumNous/new-api/internal/catalog"
	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/logger"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	relayconstant "github.com/QuantumNous/new-api/internal/relay/constant"
	"github.com/QuantumNous/new-api/internal/responsecache"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/QuantumNous/new-api/internal/transport/contract"
)

// responseCacheConfigSnapshot rebuilds the runtime cache config from the
// option-backed common values on every call. The option system hot-reloads
// these fields; syncing them into the store on each write keeps the store's
// enabled/capacity/TTL state aligned with the admin switch without an extra
// import cycle between responsecache and common.
func responseCacheConfigSnapshot() responsecache.Config {
	return responsecache.Config{
		Enabled:     common.ResponseCacheEnabled,
		TTLSeconds:  common.ResponseCacheTtlSeconds,
		MaxEntries:  common.ResponseCacheMaxEntries,
		MaxBodySize: common.ResponseCacheMaxBodySize,
	}
}

// responseCacheEligible reports whether a request may be served from (and
// stored into) the response cache. Conservative by default: only the OpenAI
// chat-completions relay with a deterministic, non-streaming, non-passthrough
// request.
func responseCacheEligible(info *relaycommon.RelayInfo, req *dto.GeneralOpenAIRequest) bool {
	if info.RelayMode != relayconstant.RelayModeChatCompletions {
		return false
	}
	// Only OpenAI-format output is cached: the replay hardcodes the OpenAI
	// JSON content type, and Claude/Gemini-format bodies would be served with
	// the wrong envelope.
	if info.RelayFormat != types.RelayFormatOpenAI {
		return false
	}
	// Pass-through channels forward the raw provider body; a cached pass-through
	// response would be replayed as OpenAI JSON even though the provider may
	// have returned a different format. Exclude them.
	if info.ChannelSetting.PassThroughBodyEnabled ||
		model_setting.GetGlobalSettings().PassThroughRequestEnabled {
		return false
	}
	// Channel-level mutations (system prompt prepended/merged into messages,
	// ParamOverride applied to the wire body, channel-disabled fields removed)
	// change the response after this eligibility point but are not part of the
	// cache key, which covers only the raw client body plus upstream model.
	// Caching such channels would cross-serve content (e.g. channel A's
	// system prompt replayed to channel B). Exclude them for safety.
	if info.ChannelSetting.ResolveSystemPrompt(info.OriginModelName) != "" || len(info.ParamOverride) > 0 {
		return false
	}
	// ChannelOtherSettings influences RemoveDisabledFields (which deletes
	// fields from the converted body), so any non-zero setting makes the cached
	// body channel-specific in a way the key cannot capture. Treat as
	// ineligible whenever the raw JSON representation is non-empty. Most
	// channels carry only administrative bookkeeping, so this disables caching
	// broadly; correctness wins over hit rate, and a follow-up can hash the
	// actually-mutated wire body instead.
	var hasOtherSettings bool
	if b, err := common.Marshal(info.ChannelOtherSettings); err == nil && len(b) > 2 { // "{}" means no settings
		hasOtherSettings = true
	}
	if hasOtherSettings {
		return false
	}
	if !common.ResponseCacheEnabled {
		return false
	}
	// Streaming replays chunk boundaries; v1 caches only buffered non-stream
	// bodies, matching what CaptureResponse can faithfully reproduce.
	if req.Stream != nil && *req.Stream {
		return false
	}
	// temperature > 0 is non-deterministic: the same key could yield different
	// outputs. Only cache deterministic requests by default.
	if req.Temperature != nil && *req.Temperature != 0 {
		return false
	}
	// Tool/web-search requests bill per-call surcharges from state accumulated
	// while parsing the upstream response; a hit never parses one, so it would
	// undercharge. Exclude them rather than cache a wrong bill.
	if len(req.Tools) > 0 || req.Functions != nil || req.ToolChoice != nil ||
		req.FunctionCall != nil || req.WebSearchOptions != nil {
		return false
	}
	return true
}

// responseCacheBuildKey derives a stable fingerprint from the normalized
// request. Volatile fields that do not change the generated content (stream,
// user, logit_bias, per-request ids) are stripped before hashing so identical
// semantic requests collapse onto one key. A shallow copy is enough: the
// stripped fields are top-level.
func responseCacheBuildKey(info *relaycommon.RelayInfo, req *dto.GeneralOpenAIRequest) (string, error) {
	norm := *req
	norm.Stream = nil
	norm.User = nil
	norm.LogitBias = nil
	norm.Metadata = nil
	norm.SafetyIdentifier = nil
	// Per-run tuning that can change output is dropped so two requests that
	// differ only here share an answer when the rest is identical.
	norm.ThinkingBudget = nil
	norm.EnableThinking = nil

	canonical, err := common.Marshal(&norm)
	if err != nil {
		return "", err
	}
	return responsecache.Key(canonical, info.GetUpstreamModelName()), nil
}

// responseCacheTryLoad syncs the runtime config and returns a cached payload
// for key when the cache is enabled and the entry is unexpired. Syncing the
// config first means a disabled cache (or one whose switch was turned off
// since the last write) short-circuits here rather than resurrecting an entry.
func responseCacheTryLoad(key string) (*responsecache.Payload, bool) {
	responsecache.SetConfig(responseCacheConfigSnapshot())
	return responsecache.Get(key)
}

// responseCacheReplay writes a cached payload back to the client, mirroring
// the header/content-length ordering the upstream path uses. It returns an
// error when there is no response stream to write to, matching the rest of
// the relay's convention (see ErrNoResponseStream callers); TextHelper must
// not charge or settle in that case.
func responseCacheReplay(c contract.Context, p *responsecache.Payload) error {
	stream := c.ResponseStream()
	if stream == nil {
		return fmt.Errorf("response cache hit: nil response stream")
	}
	if p.ContentType != "" {
		stream.SetHeader("Content-Type", p.ContentType)
	}
	stream.SetHeader("Content-Length", strconv.Itoa(len(p.Body)))
	if p.Status != 0 {
		stream.WriteHeader(p.Status)
	} else {
		stream.WriteHeader(http.StatusOK)
	}
	if _, err := io.Copy(stream, bytes.NewReader(p.Body)); err != nil {
		logger.LogError(c.Context(), fmt.Sprintf("response cache replay write failed: %s", err.Error()))
		return err
	}
	if stream.CanFlush() {
		_ = stream.Flush()
	}
	responsecache.RecordHit()
	return nil
}

// responseCacheStore saves an upstream response body under key when eligible.
func responseCacheStore(key string, status int, contentType string, body, usageJSON []byte) {
	responsecache.SetConfig(responseCacheConfigSnapshot())
	responsecache.Put(key, responsecache.Payload{Status: status, ContentType: contentType, Body: body, UsageJSON: usageJSON}, common.ResponseCacheMaxBodySize)
}

// responseCacheSettle charges a cache hit the same amount the originating miss
// settled. The cached payload carries the usage record the miss billed
// against; without it a hit would return a free response and leave the
// PreConsumeBilling session un-settled, so a hit must settle exactly like the
// miss did. The audio/text dispatch mirrors TextHelper's default branch.
func responseCacheSettle(c contract.Context, info *relaycommon.RelayInfo, p *responsecache.Payload) {
	if len(p.UsageJSON) == 0 {
		// No billable usage was captured at miss time; settle nothing rather
		// than risk a wrong charge, matching the miss path's "no billable
		// usage" handling.
		return
	}
	var usage dto.Usage
	if err := common.Unmarshal(p.UsageJSON, &usage); err != nil {
		logger.LogError(c.Context(), fmt.Sprintf("response cache hit: failed to unmarshal cached usage: %s", err.Error()))
		return
	}
	if usage.CompletionTokenDetails.AudioTokens > 0 || usage.PromptTokensDetails.AudioTokens > 0 {
		billing.PostAudioConsumeQuota(c, info, &usage, "")
	} else {
		billing.PostTextConsumeQuota(c, info, &usage, nil)
	}
}
