package common

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// TextPlan is the single routing decision for a text request: client format,
// upstream native format, and the outbound path family that matches that native
// format. Body conversion, GetRequestURL, and DoResponse all read this instead
// of rewriting RelayMode or guessing from the inbound path.
type TextPlan struct {
	Client   types.RelayFormat
	Native   types.RelayFormat
	Outbound Outbound
}

// Outbound is the protocol-shaped request line relative to ChannelBaseUrl.
// Channel dialect (Azure deployments, Vertex publishers, Gemini versions) may
// still wrap Path; they must not pick a different native format.
type Outbound struct {
	Method  string
	Path    string
	Query   url.Values
	Headers map[string]string
}

func (o Outbound) RequestPath() string {
	path := o.Path
	if path == "" {
		return ""
	}
	if len(o.Query) == 0 {
		return path
	}
	return path + "?" + o.Query.Encode()
}

// BuildTextPlan computes Client/Native/Outbound once and stores it on info.
// upgradeToResponses is the admin Chat→Responses policy; it only changes Native.
func (info *RelayInfo) BuildTextPlan(upgradeToResponses bool) *TextPlan {
	if info == nil {
		return nil
	}
	client := info.RelayFormat
	native := NativeTextFormat(info, client)
	if override, ok := info.advancedCustomNative(client); ok {
		native = override
	} else if upgradeToResponses {
		native = types.RelayFormatOpenAIResponses
	}
	plan := &TextPlan{
		Client:   client,
		Native:   native,
		Outbound: defaultTextOutbound(info, native),
	}
	info.TextPlan = plan
	info.FinalRequestRelayFormat = native
	if native != "" && native != client {
		info.AppendRequestConversion(native)
	}
	return plan
}

func (info *RelayInfo) HasTextPlan() bool {
	return info != nil && info.TextPlan != nil && info.TextPlan.Native != ""
}

// TextNative is the upstream wire format. Falls back to NativeTextFormat when
// no plan has been built (channel-test and non-text helpers).
func (info *RelayInfo) TextNative() types.RelayFormat {
	if info != nil && info.TextPlan != nil && info.TextPlan.Native != "" {
		return info.TextPlan.Native
	}
	if info == nil {
		return ""
	}
	return NativeTextFormat(info, info.RelayFormat)
}

// TextPlanApplies reports whether this request is a text generation call that
// should follow TextPlan for URL and response dispatch.
func (info *RelayInfo) TextPlanApplies() bool {
	if !info.HasTextPlan() {
		return false
	}
	switch info.RelayMode {
	case relayconstant.RelayModeChatCompletions,
		relayconstant.RelayModeUnknown,
		relayconstant.RelayModeGemini,
		relayconstant.RelayModeResponses,
		relayconstant.RelayModeResponsesCompact:
		return true
	default:
		return false
	}
}

// OpenAICompatibleRequestPath is the relative path for Chat/Responses/Claude
// OpenAI-compatible channels. Gemini/Vertex fill their own URLs.
func (info *RelayInfo) OpenAICompatibleRequestPath() (string, bool) {
	if !info.TextPlanApplies() {
		return "", false
	}
	switch info.TextPlan.Native {
	case types.RelayFormatGemini:
		return "", false
	}
	path := info.TextPlan.Outbound.RequestPath()
	if path == "" {
		return "", false
	}
	return path, true
}

func (info *RelayInfo) advancedCustomNative(client types.RelayFormat) (types.RelayFormat, bool) {
	if info == nil || info.ChannelMeta == nil || info.ChannelType != constant.ChannelTypeAdvancedCustom {
		return "", false
	}
	config := info.ChannelOtherSettings.AdvancedCustom
	if config == nil {
		return "", false
	}
	path := strings.Split(info.RequestURLPath, "?")[0]
	route, ok := config.MatchPathForModel(path, info.OriginModelName)
	if !ok {
		return "", false
	}
	target := route.ResolvedTarget()
	if target == "" || target == dto.AdvancedCustomTargetNative {
		return "", false
	}
	return dto.AdvancedCustomTargetFormat(target, client), true
}

func defaultTextOutbound(info *RelayInfo, native types.RelayFormat) Outbound {
	switch native {
	case types.RelayFormatOpenAIResponses:
		path := "/v1/responses"
		if info != nil && info.RelayMode == relayconstant.RelayModeResponsesCompact {
			path = "/v1/responses/compact"
		}
		return Outbound{Method: http.MethodPost, Path: path}
	case types.RelayFormatClaude:
		outbound := Outbound{Method: http.MethodPost, Path: "/v1/messages"}
		if info != nil && (info.IsClaudeBetaQuery || (info.ChannelMeta != nil && info.ChannelOtherSettings.ClaudeBetaQuery)) {
			outbound.Query = url.Values{"beta": []string{"true"}}
		}
		return outbound
	case types.RelayFormatGemini:
		return Outbound{Method: http.MethodPost}
	default:
		return Outbound{Method: http.MethodPost, Path: "/v1/chat/completions"}
	}
}

// IsEventStreamContentType reports whether a response is SSE.
func IsEventStreamContentType(contentType string) bool {
	return strings.Contains(strings.ToLower(contentType), "text/event-stream")
}
