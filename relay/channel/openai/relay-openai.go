package openai

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel/openrouter"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func sendStreamData(c *gin.Context, info *relaycommon.RelayInfo, data string, forceFormat bool, thinkToContent bool) error {
	return helper.WriteChatCompletionsStreamData(c, info, data, forceFormat, thinkToContent)
}

// IsLegacyCompletionsEndpoint identifies the unplanned /v1/completions path
// that an OpenAI-compatible adaptor forwards as the legacy wire protocol. The
// response handlers use this explicit endpoint boundary instead of RelayMode.
func IsLegacyCompletionsEndpoint(info *relaycommon.RelayInfo) bool {
	if info == nil || info.TextPlanApplies() {
		return false
	}
	path := strings.SplitN(info.RequestURLPath, "?", 2)[0]
	return strings.TrimRight(path, "/") == "/v1/completions"
}

func OaiStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if info == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("relay info is required"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	if resp == nil || resp.Body == nil {
		logger.LogError(c, "invalid response or response body")
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	defer service.CloseResponseBodyGracefully(resp)

	if info.HasTextPlan() && info.TextNative() != types.RelayFormatOpenAI {
		err := fmt.Errorf("OpenAI Chat stream handler received unexpected source format %s", info.TextNative())
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	projected := info.RelayFormat != "" && info.RelayFormat != types.RelayFormatOpenAI
	var streamState *relayconvert.ResponseStreamState
	if projected {
		var err error
		streamState, err = relayconvert.NewResponseStreamState(types.RelayFormatOpenAI, info.RelayFormat, relayconvert.ResponseStreamOptions{
			ID:           helper.GetResponseID(c),
			Model:        info.UpstreamModelName,
			Created:      common.GetTimestamp(),
			IncludeUsage: info.ShouldIncludeUsage,
		})
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
		if info.RelayFormat == types.RelayFormatClaude {
			info.EnsureClaudeConvertInfo()
		}
	}

	model := info.UpstreamModelName
	var responseID string
	var createdAt int64
	var systemFingerprint string
	var containStreamUsage bool
	stats := newChatStreamStats()
	usage := &dto.Usage{}
	var lastStreamData string
	var usageStreamData string
	var lastStreamResponse *dto.ChatCompletionsStreamResponse
	var streamErr *types.NewAPIError

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		if streamErr != nil {
			sr.Stop(streamErr)
			return
		}

		// Native Chat passthrough keeps the existing one-chunk delay so a trailing
		// usage-only chunk can still be hidden when the client did not request it.
		// Cross-format projection never delays or replays a source chunk.
		if !projected && lastStreamData != "" {
			if err := sendStreamData(c, info, lastStreamData, info.ChannelSetting.ForceFormat, info.ChannelSetting.ThinkingToContent); err != nil {
				common.SysLog("error handling OpenAI Chat stream data: " + err.Error())
				streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
				sr.Stop(streamErr)
				return
			}
			info.SendResponseCount++
		}
		if data == "" {
			return
		}
		lastStreamData = data

		var streamResponse dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			logger.LogError(c, "error parsing OpenAI Chat stream data: "+err.Error())
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
			sr.Stop(streamErr)
			return
		}
		if oaiError := streamResponse.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
			streamErr = types.WithOpenAIError(*oaiError, resp.StatusCode)
			sr.Stop(streamErr)
			return
		}

		lastStreamResponse = &streamResponse
		if streamResponse.Id != "" {
			responseID = streamResponse.Id
		}
		if streamResponse.Created != 0 {
			createdAt = streamResponse.Created
		}
		if streamResponse.Model != "" {
			model = streamResponse.Model
		}
		if fingerprint := streamResponse.GetSystemFingerprint(); fingerprint != "" {
			systemFingerprint = fingerprint
		}
		if service.ValidUsage(streamResponse.Usage) {
			usage = streamResponse.Usage
			containStreamUsage = true
			usageStreamData = data
		}
		stats.Observe(streamResponse)

		if !projected {
			return
		}
		results, err := relayconvert.ConvertStreamResponseChunk(c, info, streamState, &streamResponse)
		if err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
			sr.Stop(streamErr)
			return
		}
		if err := helper.WriteProjectedStreamResults(c, info, results); err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
			sr.Stop(streamErr)
			return
		}
		info.SendResponseCount++
	})

	if streamErr != nil {
		return nil, streamErr
	}
	if endErr := openAIStreamEndError(info, "OpenAI Chat"); endErr != nil {
		return nil, endErr
	}

	shouldSendLastResponse := true
	if lastStreamResponse != nil && service.ValidUsage(lastStreamResponse.Usage) && !info.ShouldIncludeUsage {
		shouldSendLastResponse = false
		for _, choice := range lastStreamResponse.Choices {
			if choice.Delta.GetContentString() != "" || choice.Delta.GetReasoningContent() != "" {
				shouldSendLastResponse = true
				break
			}
		}
	}
	if !projected && shouldSendLastResponse && lastStreamData != "" {
		if err := sendStreamData(c, info, lastStreamData, info.ChannelSetting.ForceFormat, info.ChannelSetting.ThinkingToContent); err != nil {
			logger.LogError(c, "error sending final OpenAI Chat stream data: "+err.Error())
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
		info.SendResponseCount++
	}

	if !containStreamUsage {
		usage = service.ResponseText2Usage(c, stats.Text(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		usage.CompletionTokens += stats.ToolCount() * 7
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}
	if usageStreamData == "" {
		usageStreamData = lastStreamData
	}
	applyUsagePostProcessing(info, usage, common.StringToByteSlice(usageStreamData))

	if projected {
		streamState.SetUsage(usage)
		if info.RelayFormat == types.RelayFormatClaude {
			info.EnsureClaudeConvertInfo().Usage = usage
		}
		finalResults, err := relayconvert.FinalizeStreamResponse(c, info, streamState)
		if err != nil {
			return usage, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
		if err := helper.WriteProjectedStreamResults(c, info, finalResults); err != nil {
			return usage, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
		for _, name := range stats.FunctionCallNames() {
			info.CountBillableToolCall(dto.BuildInCallFunctionCall, name)
		}
		return usage, nil
	}

	if info.ShouldIncludeUsage && !containStreamUsage {
		response := helper.GenerateFinalUsageResponse(responseID, createdAt, model, *usage)
		response.SetSystemFingerprint(systemFingerprint)
		if err := helper.ObjectData(c, response); err != nil {
			logger.LogError(c, "error sending final OpenAI Chat usage: "+err.Error())
			return usage, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
	}
	for _, name := range stats.FunctionCallNames() {
		info.CountBillableToolCall(dto.BuildInCallFunctionCall, name)
	}
	helper.Done(c)
	return usage, nil
}

// OaiCompletionsStreamHandler owns the legacy /v1/completions wire format.
// Legacy text completions are never parsed as Chat Completions and cannot be
// projected to Gemini, Claude, or Responses.
func OaiCompletionsStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if info == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("relay info is required"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	if resp == nil || resp.Body == nil {
		logger.LogError(c, "invalid response or response body")
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	defer service.CloseResponseBodyGracefully(resp)

	if info.RelayFormat != "" && info.RelayFormat != types.RelayFormatOpenAI {
		err := fmt.Errorf("legacy OpenAI Completions stream cannot be projected to %s", info.RelayFormat)
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	model := info.UpstreamModelName
	var responseID string
	var createdAt int64
	var systemFingerprint *string
	var containStreamUsage bool
	var responseTextBuilder strings.Builder
	usage := &dto.Usage{}
	var lastStreamData string
	var usageStreamData string
	var lastStreamResponse *dto.CompletionsStreamResponse
	var streamErr *types.NewAPIError

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		if streamErr != nil {
			sr.Stop(streamErr)
			return
		}
		if lastStreamData != "" {
			if err := helper.StringData(c, lastStreamData); err != nil {
				streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
				sr.Stop(streamErr)
				return
			}
			info.SendResponseCount++
		}
		if data == "" {
			return
		}
		lastStreamData = data

		var streamResponse dto.CompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			logger.LogError(c, "error parsing legacy OpenAI Completions stream data: "+err.Error())
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
			sr.Stop(streamErr)
			return
		}
		if oaiError := streamResponse.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
			streamErr = types.WithOpenAIError(*oaiError, resp.StatusCode)
			sr.Stop(streamErr)
			return
		}

		lastStreamResponse = &streamResponse
		if streamResponse.Id != "" {
			responseID = streamResponse.Id
		}
		if streamResponse.Created != 0 {
			createdAt = streamResponse.Created
		}
		if streamResponse.Model != "" {
			model = streamResponse.Model
		}
		if streamResponse.SystemFingerprint != nil {
			systemFingerprint = streamResponse.SystemFingerprint
		}
		if service.ValidUsage(streamResponse.Usage) {
			usage = streamResponse.Usage
			containStreamUsage = true
			usageStreamData = data
		}
		processCompletionsStreamResponse(streamResponse, &responseTextBuilder)
	})

	if streamErr != nil {
		return nil, streamErr
	}
	if endErr := openAIStreamEndError(info, "legacy OpenAI Completions"); endErr != nil {
		return nil, endErr
	}

	shouldSendLastResponse := true
	if lastStreamResponse != nil && service.ValidUsage(lastStreamResponse.Usage) && !info.ShouldIncludeUsage {
		shouldSendLastResponse = false
		for _, choice := range lastStreamResponse.Choices {
			if choice.Text != "" {
				shouldSendLastResponse = true
				break
			}
		}
	}
	if shouldSendLastResponse && lastStreamData != "" {
		if err := helper.StringData(c, lastStreamData); err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
		info.SendResponseCount++
	}

	if !containStreamUsage {
		usage = service.ResponseText2Usage(c, responseTextBuilder.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
	}
	if usageStreamData == "" {
		usageStreamData = lastStreamData
	}
	applyUsagePostProcessing(info, usage, common.StringToByteSlice(usageStreamData))

	if info.ShouldIncludeUsage && !containStreamUsage {
		response := &dto.CompletionsStreamResponse{
			Id:                responseID,
			Object:            "text_completion",
			Created:           createdAt,
			Model:             model,
			SystemFingerprint: systemFingerprint,
			Choices:           make([]dto.CompletionsStreamResponseChoice, 0),
			Usage:             usage,
		}
		if err := helper.ObjectData(c, response); err != nil {
			return usage, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
	}
	helper.Done(c)
	return usage, nil
}

func openAIStreamEndError(info *relaycommon.RelayInfo, source string) *types.NewAPIError {
	if info == nil || info.StreamStatus == nil || info.StreamStatus.IsNormalEnd() {
		return nil
	}
	if info.StreamStatus.EndError != nil {
		err := fmt.Errorf("%s stream ended abnormally (%s): %w", source, info.StreamStatus.EndReason, info.StreamStatus.EndError)
		return types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	err := fmt.Errorf("%s stream ended abnormally (%s)", source, info.StreamStatus.EndReason)
	return types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
}

func OpenaiHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	var simpleResponse dto.OpenAITextResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	logger.LogDebug(c, "upstream response body: %s", responseBody)
	// Unmarshal to simpleResponse
	if info.ChannelType == constant.ChannelTypeOpenRouter && info.ChannelOtherSettings.IsOpenRouterEnterprise() {
		// 尝试解析为 openrouter enterprise
		var enterpriseResponse openrouter.OpenRouterEnterpriseResponse
		err = common.Unmarshal(responseBody, &enterpriseResponse)
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
		if enterpriseResponse.Success {
			responseBody = enterpriseResponse.Data
		} else {
			logger.LogError(c, fmt.Sprintf("openrouter enterprise response success=false, data: %s", enterpriseResponse.Data))
			return nil, types.NewOpenAIError(fmt.Errorf("openrouter response success=false"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
	}

	err = common.Unmarshal(responseBody, &simpleResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if oaiError := simpleResponse.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}

	for _, choice := range simpleResponse.Choices {
		if choice.FinishReason == constant.FinishReasonContentFilter {
			common.SetContextKey(c, constant.ContextKeyAdminRejectReason, "openai_finish_reason=content_filter")
			break
		}
	}

	for _, choice := range simpleResponse.Choices {
		for _, tc := range choice.Message.ParseToolCalls() {
			info.CountBillableToolCall(dto.BuildInCallFunctionCall, tc.Function.Name)
		}
	}

	forceFormat := false
	if info.ChannelSetting.ForceFormat {
		forceFormat = true
	}

	usageModified := false
	if simpleResponse.Usage.PromptTokens == 0 {
		completionTokens := simpleResponse.Usage.CompletionTokens
		if completionTokens == 0 {
			for _, choice := range simpleResponse.Choices {
				ctkm := service.CountTextToken(choice.Message.StringContent()+choice.Message.GetReasoningContent(), info.UpstreamModelName)
				completionTokens += ctkm
			}
		}
		simpleResponse.Usage = dto.Usage{
			PromptTokens:     info.GetEstimatePromptTokens(),
			CompletionTokens: completionTokens,
			TotalTokens:      info.GetEstimatePromptTokens() + completionTokens,
		}
		usageModified = true
	}

	applyUsagePostProcessing(info, &simpleResponse.Usage, responseBody)

	switch info.RelayFormat {
	case types.RelayFormatOpenAI:
		if usageModified {
			var bodyMap map[string]interface{}
			err = common.Unmarshal(responseBody, &bodyMap)
			if err != nil {
				return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
			}
			bodyMap["usage"] = simpleResponse.Usage
			responseBody, _ = common.Marshal(bodyMap)
		}
		if forceFormat {
			responseBody, err = common.Marshal(simpleResponse)
			if err != nil {
				return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
			}
		} else {
			break
		}
	case types.RelayFormatClaude:
		convertResult, err := relayconvert.ConvertResponse(c, info, types.RelayFormatClaude, &simpleResponse)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		claudeRespStr, err := common.Marshal(convertResult.Value)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		responseBody = claudeRespStr
	case types.RelayFormatGemini:
		convertResult, err := relayconvert.ConvertResponse(c, info, types.RelayFormatGemini, &simpleResponse)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		geminiRespStr, err := common.Marshal(convertResult.Value)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		responseBody = geminiRespStr
	case types.RelayFormatOpenAIResponses:
		convertResult, err := relayconvert.ConvertResponse(c, info, types.RelayFormatOpenAIResponses, &simpleResponse)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		responsesBody, err := common.Marshal(convertResult.Value)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		responseBody = responsesBody
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)

	return &simpleResponse.Usage, nil
}
