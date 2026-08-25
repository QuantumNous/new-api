package relay

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel"
	openaichannel "github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/gin-gonic/gin"
)

func isChatSystemRole(role, preferred string) bool {
	return role == preferred || role == "system" || role == "developer"
}

// shouldUpgradeChatToResponses reports whether this request should be sent as
// OpenAI Responses even though the client used Chat / Claude / Gemini.
// The admin chat_completions_to_responses_policy selects models; the channel
// must actually speak Responses, otherwise the upgrade is skipped and the
// Chat hub converts to the channel's native format instead.
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

func convertToChatAndRelayViaResponses(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.Adaptor, request any) (*dto.Usage, *types.NewAPIError) {
	chatRequest, ok := request.(*dto.GeneralOpenAIRequest)
	if !ok {
		result, err := service.ConvertRequest(c, info, types.RelayFormatOpenAI, request)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		chatRequest, ok = result.Value.(*dto.GeneralOpenAIRequest)
		if !ok {
			return nil, types.NewError(fmt.Errorf("expected OpenAI chat completions request, got %T", result.Value), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
	}
	return chatCompletionsViaResponses(c, info, adaptor, chatRequest)
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

func chatCompletionsViaResponses(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.Adaptor, request *dto.GeneralOpenAIRequest) (*dto.Usage, *types.NewAPIError) {
	chatJSON, err := common.Marshal(request)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	chatJSON, err = relaycommon.RemoveDisabledFields(chatJSON, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	if len(info.ParamOverride) > 0 {
		chatJSON, err = relaycommon.ApplyParamOverrideWithRelayInfo(chatJSON, info)
		if err != nil {
			return nil, newAPIErrorFromParamOverride(err)
		}
	}

	var overriddenChatReq dto.GeneralOpenAIRequest
	if err := common.Unmarshal(chatJSON, &overriddenChatReq); err != nil {
		return nil, types.NewError(err, types.ErrorCodeChannelParamOverrideInvalid, types.ErrOptionWithSkipRetry())
	}

	result, err := service.ConvertRequestVia(c, info, &overriddenChatReq, types.RelayFormatOpenAI, types.RelayFormatOpenAIResponses)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	responsesReq, ok := result.Value.(*dto.OpenAIResponsesRequest)
	if !ok {
		return nil, types.NewError(fmt.Errorf("expected OpenAI responses request, got %T", result.Value), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	savedRelayMode := info.RelayMode
	savedRequestURLPath := info.RequestURLPath
	defer func() {
		info.RelayMode = savedRelayMode
		info.RequestURLPath = savedRequestURLPath
	}()

	info.RelayMode = relayconstant.RelayModeResponses
	info.RequestURLPath = "/v1/responses"

	convertedRequest, err := adaptor.ConvertOpenAIResponsesRequest(c, info, *responsesReq)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)

	jsonData, err := common.Marshal(convertedRequest)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	jsonData, err = relaycommon.RemoveDisabledFields(jsonData, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	body, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	defer closer.Close()
	jsonData = nil
	var requestBody io.Reader = body

	var httpResp *http.Response
	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	if resp == nil {
		return nil, types.NewOpenAIError(nil, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	httpResp = resp.(*http.Response)
	clientStream := info.IsStream
	upstreamStream := isResponsesEventStreamContentType(httpResp.Header.Get("Content-Type"))
	info.IsStream = clientStream || upstreamStream
	if httpResp.StatusCode != http.StatusOK {
		newApiErr := service.RelayErrorHandler(c.Request.Context(), httpResp, false)
		service.ResetStatusCode(newApiErr, statusCodeMappingStr)
		return nil, newApiErr
	}

	if upstreamStream && clientStream {
		usage, newApiErr := openaichannel.OaiResponsesToChatStreamHandler(c, info, httpResp)
		if newApiErr != nil {
			service.ResetStatusCode(newApiErr, statusCodeMappingStr)
			return nil, newApiErr
		}
		return usage, nil
	}
	if upstreamStream {
		info.IsStream = false
		usage, newApiErr := openaichannel.OaiResponsesToChatBufferedStreamHandler(c, info, httpResp)
		if newApiErr != nil {
			service.ResetStatusCode(newApiErr, statusCodeMappingStr)
			return nil, newApiErr
		}
		return usage, nil
	}

	usage, newApiErr := openaichannel.OaiResponsesToChatHandler(c, info, httpResp)
	if newApiErr != nil {
		service.ResetStatusCode(newApiErr, statusCodeMappingStr)
		return nil, newApiErr
	}
	return usage, nil
}

func isResponsesEventStreamContentType(contentType string) bool {
	return strings.Contains(strings.ToLower(contentType), "text/event-stream")
}
