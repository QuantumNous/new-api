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
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
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

func OaiStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		logger.LogError(c, "invalid response or response body")
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	projected := info.RelayFormat != "" && info.RelayFormat != types.RelayFormatOpenAI
	if projected && info.RelayMode != relayconstant.RelayModeChatCompletions {
		err := fmt.Errorf("cannot project OpenAI completions stream to %s", info.RelayFormat)
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

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
	var responseTextBuilder strings.Builder
	var toolCount int
	usage := &dto.Usage{}
	var lastStreamData string
	var usageStreamData string
	var lastStreamResponse *dto.ChatCompletionsStreamResponse
	seenStreamToolCalls := make(map[string]struct{})
	var streamFunctionCallNames []string
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
				common.SysLog("error handling OpenAI stream data: " + err.Error())
				sr.Error(err)
			} else {
				info.SendResponseCount++
			}
		}
		if data == "" {
			return
		}
		lastStreamData = data

		var streamResponse dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			logger.LogError(c, "error parsing OpenAI stream data: "+err.Error())
			if projected {
				streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
				sr.Stop(streamErr)
				return
			}
			sr.Error(err)
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

		switch info.RelayMode {
		case relayconstant.RelayModeChatCompletions:
			collectStreamFunctionCallNames(streamResponse, seenStreamToolCalls, &streamFunctionCallNames)
			if err := ProcessStreamResponse(streamResponse, &responseTextBuilder, &toolCount); err != nil {
				logger.LogError(c, "error processing stream token data: "+err.Error())
				sr.Error(err)
			}
		case relayconstant.RelayModeCompletions:
			if err := processTokenData(info.RelayMode, data, &responseTextBuilder, &toolCount); err != nil {
				logger.LogError(c, "error processing stream token data: "+err.Error())
				sr.Error(err)
			}
		}

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
			logger.LogError(c, "error sending final OpenAI stream data: "+err.Error())
		} else {
			info.SendResponseCount++
		}
	}

	if !containStreamUsage {
		usage = service.ResponseText2Usage(c, responseTextBuilder.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		usage.CompletionTokens += toolCount * 7
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}
	if usageStreamData == "" {
		usageStreamData = lastStreamData
	}
	applyUsagePostProcessing(info, usage, common.StringToByteSlice(usageStreamData))

	for _, name := range streamFunctionCallNames {
		info.CountBillableToolCall(dto.BuildInCallFunctionCall, name)
	}

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
		return usage, nil
	}

	if info.ShouldIncludeUsage && !containStreamUsage {
		response := helper.GenerateFinalUsageResponse(responseID, createdAt, model, *usage)
		response.SetSystemFingerprint(systemFingerprint)
		if err := helper.ObjectData(c, response); err != nil {
			logger.LogError(c, "error sending final OpenAI usage: "+err.Error())
		}
	}
	helper.Done(c)
	return usage, nil
}

func collectStreamFunctionCallNames(streamResponse dto.ChatCompletionsStreamResponse, seen map[string]struct{}, names *[]string) {
	for _, choice := range streamResponse.Choices {
		for i, tc := range choice.Delta.ToolCalls {
			name := tc.Function.Name
			if name == "" {
				continue
			}
			toolIdx := i
			if tc.Index != nil {
				toolIdx = *tc.Index
			}
			key := fmt.Sprintf("%d-%d", choice.Index, toolIdx)
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			*names = append(*names, name)
		}
	}
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
