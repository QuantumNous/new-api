package helper

import (
	"strings"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/QuantumNous/new-api/setting/model_setting"
)

// ApplyReasoningModelSuffix parses host-private reasoning suffixes from the
// origin and mapped model names, attaches the resulting intent to RelayInfo,
// and normalizes UpstreamModelName to the unsuffixed base. Optional outbound
// requests are the DeepCopy the handler will send upstream; they must be
// synced here because info.Request is the original, not that copy. Conflict
// between an explicit request field and a suffix is a client error.
func ApplyReasoningModelSuffix(info *relaycommon.RelayInfo, outbound ...dto.Request) error {
	if info == nil {
		return nil
	}
	passThrough := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	if info.ChannelMeta != nil && info.ChannelSetting.PassThroughBodyEnabled {
		passThrough = true
	}
	if passThrough {
		return nil
	}

	opts := info.ConvOptions()
	origin := info.GetOriginModelName()
	upstream := ""
	if info.ChannelMeta != nil {
		upstream = info.UpstreamModelName
	}
	if opts.ShouldPreserveThinkingSuffix(origin) || opts.ShouldPreserveThinkingSuffix(upstream) {
		return nil
	}

	originBase, originIntent, originFound, err := parseHostModelSuffix(origin, opts)
	if err != nil {
		return reasoning.AsClientError(err)
	}
	upstreamBase, upstreamIntent, upstreamFound, err := parseHostModelSuffix(upstream, opts)
	if err != nil {
		return reasoning.AsClientError(err)
	}

	suffix := originIntent
	if originFound && upstreamFound {
		suffix, err = reasoning.MergeExplicitAndSuffix(originIntent, upstreamIntent, origin)
		if err != nil {
			return reasoning.AsClientError(err)
		}
	} else if upstreamFound {
		suffix = upstreamIntent
	}

	explicit, err := explicitIntentFromRequest(info.Request)
	if err != nil {
		return reasoning.AsClientError(err)
	}
	conflictModel := upstream
	if conflictModel == "" {
		conflictModel = origin
	}
	if _, err = reasoning.MergeExplicitAndSuffix(explicit, suffix, conflictModel); err != nil {
		return reasoning.AsClientError(err)
	}

	if !suffix.IsEmpty() {
		info.ReasoningConversion = reasoning.StateFromIntent(suffix)
	}

	if upstreamFound && info.ChannelMeta != nil {
		info.UpstreamModelName = upstreamBase
	} else if !info.IsModelMapped && originFound && info.ChannelMeta != nil {
		info.UpstreamModelName = originBase
	}
	// Handlers DeepCopy before this helper; info.Request is the original.
	// Sync every outbound copy the caller is about to send upstream.
	for _, outbound := range outbound {
		if outbound != nil {
			outbound.SetModelName(info.UpstreamModelName)
		}
	}
	if info.Request != nil {
		info.Request.SetModelName(info.UpstreamModelName)
	}
	return nil
}

func parseHostModelSuffix(name string, opts *convmeta.Options) (string, reasoning.Intent, bool, error) {
	if name == "" {
		return name, reasoning.Intent{}, false, nil
	}
	if strings.HasPrefix(name, "claude-") {
		return reasoning.ParseClaudeModelSuffix(name, opts.Claude.ThinkingAdapterEnabled)
	}
	if strings.HasPrefix(name, "gemini-") {
		if !opts.Gemini.ThinkingAdapterEnabled {
			return name, reasoning.Intent{}, false, nil
		}
		return reasoning.ParseGeminiModelSuffix(name, true)
	}
	// deepseek-v4 effort tails are consumed by ParseDeepSeekV4ThinkingSuffix
	// in the DeepSeek adaptor; stripping them here drops THINKING+effort.
	if strings.HasPrefix(name, "deepseek-v4-") {
		return name, reasoning.Intent{}, false, nil
	}
	effort, base := reasoning.ParseOpenAIReasoningEffortFromModelSuffix(name, opts.PreserveEffortTail)
	if effort != "" {
		parsed, err := reasoning.ParseEffort(effort)
		if err != nil {
			return name, reasoning.Intent{}, false, err
		}
		mode := reasoning.ModeEnabled
		if parsed == reasoning.EffortNone {
			mode = reasoning.ModeDisabled
		}
		return base, reasoning.Intent{Mode: mode, Effort: parsed, Source: reasoning.SourceSuffix}, true, nil
	}
	// Generic -thinking trim is OpenRouter-only. Volcengine/DeepSeek adaptors
	// read the suffix off UpstreamModelName themselves.
	if opts != nil && opts.OpenRouterDialect && strings.HasSuffix(name, "-thinking") {
		return strings.TrimSuffix(name, "-thinking"), reasoning.Intent{Mode: reasoning.ModeEnabled, Source: reasoning.SourceSuffix}, true, nil
	}
	return name, reasoning.Intent{}, false, nil
}

func explicitIntentFromRequest(req dto.Request) (reasoning.Intent, error) {
	switch r := req.(type) {
	case *dto.ClaudeRequest:
		return reasoning.FromClaude(r)
	case *dto.GeminiChatRequest:
		return reasoning.FromGemini(r)
	case *dto.GeneralOpenAIRequest:
		return reasoning.FromOpenAIChat(r)
	case *dto.OpenAIResponsesRequest:
		return reasoning.FromOpenAIResponses(r)
	default:
		return reasoning.Intent{}, nil
	}
}
