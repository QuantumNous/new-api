package relay

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/gin-gonic/gin"
)

// resolveTextNativeOverride returns an explicit Chat/Responses routing choice
// when host policy must override the provider's inherent format.
//
// OpenAI channels use a deterministic model policy independent of the client
// endpoint: automatic mode sends mapped gpt-* models to Responses and all
// others to Chat; enabled custom rules use model_patterns as the complete
// selection for targeted channels. Responses-only models remain protected.
// Request passthrough takes precedence and preserves incoming Chat/Responses.
//
// Other providers retain the existing opt-in Chat→Responses behavior, including
// visible-thinking upgrades, but only when the provider speaks Responses.
func resolveTextNativeOverride(info *relaycommon.RelayInfo) types.RelayFormat {
	if info == nil || info.ChannelMeta == nil {
		return ""
	}
	passThrough := model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled
	if isConfiguredOpenAIChannel(info) {
		if passThrough {
			switch info.RelayFormat {
			case types.RelayFormatOpenAI, types.RelayFormatOpenAIResponses:
				return info.RelayFormat
			default:
				// OpenAI adaptors historically route foreign passthrough bodies to
				// Chat. Preserve that behavior instead of applying gpt-* auto mode.
				return types.RelayFormatOpenAI
			}
		}
		if service.ShouldOpenAIChannelUseResponsesGlobal(
			info.ChannelId,
			info.ChannelType,
			resolvedUpstreamModelName(info),
		) {
			return types.RelayFormatOpenAIResponses
		}
		return types.RelayFormatOpenAI
	}
	if passThrough {
		return ""
	}
	switch info.ChannelType {
	case constant.ChannelTypeAdvancedCustom, constant.ChannelTypeNewAPI, constant.ChannelTypeSub2API:
		// These providers pick a converter per route or speak every client
		// format natively. A Chat→Responses upgrade would bypass that.
		return ""
	case constant.ChannelTypeUnknown:
		switch info.ApiType {
		case constant.APITypeAdvancedCustom, constant.APITypeNewAPI, constant.APITypeSub2API:
			return ""
		}
	}
	if !relaycommon.SpeaksResponsesNatively(info) {
		return ""
	}
	if requestWantsVisibleThinking(info) || service.ShouldChatCompletionsUseResponsesGlobal(
		info.ChannelId,
		info.ChannelType,
		resolvedUpstreamModelName(info),
	) {
		return types.RelayFormatOpenAIResponses
	}
	return ""
}

func isConfiguredOpenAIChannel(info *relaycommon.RelayInfo) bool {
	if info == nil || info.ChannelMeta == nil {
		return false
	}
	return info.ChannelType == constant.ChannelTypeOpenAI ||
		(info.ChannelType == constant.ChannelTypeUnknown && info.ApiType == constant.APITypeOpenAI)
}

func resolvedUpstreamModelName(info *relaycommon.RelayInfo) string {
	if info == nil {
		return ""
	}
	if model := strings.TrimSpace(info.UpstreamModelName); model != "" {
		return model
	}
	return strings.TrimSpace(info.OriginModelName)
}

func requestWantsVisibleThinking(info *relaycommon.RelayInfo) bool {
	if info == nil || info.Request == nil {
		return false
	}
	switch req := info.Request.(type) {
	case *dto.GeneralOpenAIRequest:
		return reasoning.IntentFromChatRequest(*req).WantsThoughts()
	case *dto.ClaudeRequest:
		if req.Thinking != nil {
			switch strings.ToLower(strings.TrimSpace(req.Thinking.Type)) {
			case "", "disabled", "none", "off":
			default:
				return true
			}
		}
		return req.GetEfforts() != ""
	case *dto.GeminiChatRequest:
		cfg := req.GenerationConfig.ThinkingConfig
		return cfg != nil && cfg.IncludeThoughts
	default:
		return false
	}
}

func isChatSystemRole(role, preferred string) bool {
	return role == preferred || role == "system" || role == "developer"
}

func applySystemPromptIfNeeded(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) {
	if info == nil || request == nil {
		return
	}
	if info.ChannelSetting.SystemPrompt == "" {
		return
	}

	systemRole := request.GetSystemRoleName()

	containSystemPrompt := false
	for _, message := range request.Messages {
		if isChatSystemRole(message.Role, systemRole) {
			containSystemPrompt = true
			break
		}
	}
	if !containSystemPrompt {
		systemMessage := dto.Message{
			Role:    systemRole,
			Content: info.ChannelSetting.SystemPrompt,
		}
		request.Messages = append([]dto.Message{systemMessage}, request.Messages...)
		return
	}

	if !info.ChannelSetting.SystemPromptOverride {
		return
	}

	common.SetContextKey(c, constant.ContextKeySystemPromptOverride, true)
	for i, message := range request.Messages {
		if !isChatSystemRole(message.Role, systemRole) {
			continue
		}
		if message.IsStringContent() {
			request.Messages[i].SetStringContent(info.ChannelSetting.SystemPrompt + "\n" + message.StringContent())
			return
		}
		contents := message.ParseContent()
		contents = append([]dto.MediaContent{
			{
				Type: dto.ContentTypeText,
				Text: info.ChannelSetting.SystemPrompt,
			},
		}, contents...)
		request.Messages[i].Content = contents
		return
	}
}
