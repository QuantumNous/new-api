package relay

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/gin-gonic/gin"
)

// shouldUpgradeChatToResponses reports whether this request should be sent as
// OpenAI Responses even though the client used Chat / Claude / Gemini.
// The admin chat_completions_to_responses_policy selects models; the channel
// must actually speak Responses, otherwise the upgrade is skipped and the
// request converts to the channel's native format instead.
//
// The upgrade only changes TextPlan.Native. It does not rewrite RelayMode or
// RequestURLPath; GetRequestURL and DoResponse read the plan.
func shouldUpgradeChatToResponses(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return false
	}
	if model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled {
		return false
	}
	switch info.ChannelType {
	case constant.ChannelTypeAdvancedCustom, constant.ChannelTypeNewAPI, constant.ChannelTypeSub2API:
		// These providers pick a converter per route or speak every client
		// format natively. A Chat→Responses upgrade would bypass that.
		return false
	case constant.ChannelTypeUnknown:
		switch info.ApiType {
		case constant.APITypeAdvancedCustom, constant.APITypeNewAPI, constant.APITypeSub2API:
			return false
		}
	}
	if !relaycommon.SpeaksResponsesNatively(info) {
		return false
	}
	return service.ShouldChatCompletionsUseResponsesGlobal(info.ChannelId, info.ChannelType, info.OriginModelName)
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
