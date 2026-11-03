package openai

import (
	"fmt"
	"github.com/QuantumNous/new-api/internal/egress"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/constant"
	"github.com/QuantumNous/new-api/internal/logger"
	"github.com/QuantumNous/new-api/internal/relay/channel/openrouter"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	relayconstant "github.com/QuantumNous/new-api/internal/relay/constant"
	"github.com/QuantumNous/new-api/internal/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/QuantumNous/new-api/internal/transport/contract"
)

func sendStreamData(c contract.Context, info *relaycommon.RelayInfo, data string, forceFormat bool, thinkToContent bool) error {
	if data == "" {
		return nil
	}

	if !forceFormat && !thinkToContent {
		return helper.StringData(c, data)
	}

	var lastStreamResponse dto.ChatCompletionsStreamResponse
	if err := common.UnmarshalJsonStr(data, &lastStreamResponse); err != nil {
		return err
	}

	if !thinkToContent {
		return helper.ObjectData(c, lastStreamResponse)
	}

	hasThinkingContent := false
	hasContent := false
	var thinkingContent strings.Builder
	for _, choice := range lastStreamResponse.Choices {
		if len(choice.Delta.GetReasoningContent()) > 0 {
			hasThinkingContent = true
			thinkingContent.WriteString(choice.Delta.GetReasoningContent())
		}
		if len(choice.Delta.GetContentString()) > 0 {
			hasContent = true
		}
	}

	// Handle think to content conversion
	if info.ThinkingContentInfo.IsFirstThinkingContent {
		if hasThinkingContent {
			response := lastStreamResponse.Copy()
			for i := range response.Choices {
				// send `think` tag with thinking content
				response.Choices[i].Delta.SetContentString("<think>\n" + thinkingContent.String())
				response.Choices[i].Delta.ReasoningContent = nil
				response.Choices[i].Delta.Reasoning = nil
			}
			info.ThinkingContentInfo.IsFirstThinkingContent = false
			info.ThinkingContentInfo.HasSentThinkingContent = true
			return helper.ObjectData(c, response)
		}
	}

	if lastStreamResponse.Choices == nil || len(lastStreamResponse.Choices) == 0 {
		return helper.ObjectData(c, lastStreamResponse)
	}

	// Process each choice
	for i, choice := range lastStreamResponse.Choices {
		// Handle transition from thinking to content
		// only send `</think>` tag when previous thinking content has been sent
		if hasContent && !info.ThinkingContentInfo.SendLastThinkingContent && info.ThinkingContentInfo.HasSentThinkingContent {
			response := lastStreamResponse.Copy()
			for j := range response.Choices {
				response.Choices[j].Delta.SetContentString("\n</think>\n")
				response.Choices[j].Delta.ReasoningContent = nil
				response.Choices[j].Delta.Reasoning = nil
			}
			info.ThinkingContentInfo.SendLastThinkingContent = true
			helper.ObjectData(c, response)
		}

		// Convert reasoning content to regular content if any
		if len(choice.Delta.GetReasoningContent()) > 0 {
			lastStreamResponse.Choices[i].Delta.SetContentString(choice.Delta.GetReasoningContent())
			lastStreamResponse.Choices[i].Delta.ReasoningContent = nil
			lastStreamResponse.Choices[i].Delta.Reasoning = nil
		} else if !hasThinkingContent && !hasContent {
			// flush thinking content
			lastStreamResponse.Choices[i].Delta.ReasoningContent = nil
			lastStreamResponse.Choices[i].Delta.Reasoning = nil
		}
	}

	return helper.ObjectData(c, lastStreamResponse)
}

func OaiStreamHandler(c contract.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		logger.LogError(c.Context(), "invalid response or response body")
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	info.ResetStreamObservation()

	defer egress.CloseResponseBodyGracefully(resp)

	model := info.UpstreamModelName
	var responseId string
	var createAt int64 = 0
	var systemFingerprint string
	var containStreamUsage bool
	var responseTextBuilder strings.Builder
	var toolCount int
	var usage = &dto.Usage{}
	var lastStreamData string
	var secondLastStreamData string // 存储倒数第二个stream data，用于音频模型
	seenStreamToolCalls := make(map[string]struct{})
	var streamFunctionCallNames []string
	// sawFinishReason records whether any upstream chunk declared the completion
	// terminated. Combined with the scanner's end reason it separates a complete
	// stream from an upstream that died mid-answer (#394).
	var sawFinishReason bool
	var sawTextContent bool
	var lastFinishReason string
	var streamErr *types.NewAPIError

	// 检查是否为音频模型
	isAudioModel := strings.Contains(strings.ToLower(model), "audio")

	// Fast path: no format conversion is requested, so the bytes forwarded to the
	// client are byte-identical to the upstream bytes. Write them through untouched
	// and read only the fields billing and #394 need, instead of unmarshalling each
	// chunk into a DTO and serializing it back out.
	fastPath := canCopyAndObserve(info)
	var observer *streamObserver
	if fastPath {
		observer = newStreamObserver(info.RelayMode)
	}

	var heldChunk string
	var sawVisibleChunk bool
	forwardChunk := func(data string, sr *helper.StreamResult) {
		if fastPath {
			info.SendResponseCount++
			if err := helper.StringData(c, data); err != nil {
				if sr != nil {
					sr.Error(err)
				}
			}
			return
		}
		if err := HandleStreamFormat(c, info, data, info.ChannelSetting.ForceFormat, info.ChannelSetting.ThinkingToContent); err != nil {
			common.SysLog("error handling stream format: " + err.Error())
			if sr != nil {
				sr.Error(err)
			}
		}
	}
	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		if len(data) == 0 {
			return
		}
		// A 200 response that streams an error object is a disguised upstream
		// failure. Before any visible output reaches the client the request can
		// still be retried on another route; after that, keep the partial answer
		// and only record the soft error.
		if payload := streamErrorPayload(data); payload != "" {
			streamErr = types.NewOpenAIError(
				fmt.Errorf("upstream stream error: %s", payload),
				types.ErrorCodeBadResponse,
				http.StatusBadGateway,
			)
			if !sawVisibleChunk && !sawFinishReason {
				sr.Stop(streamErr.Err)
				return
			}
			info.StreamStatus.RecordError("upstream stream error: " + payload)
		}
		// 对音频模型，保存倒数第二个stream data
		if isAudioModel && lastStreamData != "" {
			secondLastStreamData = lastStreamData
		}
		lastStreamData = data
		if finishReason := firstFinishReason(data); finishReason != "" {
			lastFinishReason = finishReason
		}

		// Forward policy (#426): metadata-only preamble chunks (role/id/created
		// with empty deltas) are held so an upstream dying before any visible
		// output leaves the client byte-clean for an error response or a channel
		// retry. The first visible token flushes the held chunk ahead of itself,
		// and everything after — including the trailing usage-only chunk — goes
		// out immediately, keeping time-to-first-token equal to the upstream's.
		// The old lastStreamData pipeline delayed every chunk by one upstream
		// interval to buy this far more cheaply.
		if !sawVisibleChunk {
			if chunkHasVisibleDelta(data) {
				if heldChunk != "" {
					forwardChunk(heldChunk, sr)
					heldChunk = ""
				}
				forwardChunk(data, sr)
				sawVisibleChunk = true
			} else {
				heldChunk = data // latest preamble wins; id/model/created repeat
			}
		} else {
			forwardChunk(data, sr)
		}

		if fastPath {
			observer.observe(data)
			return
		}
		collectStreamFunctionCallNames(data, seenStreamToolCalls, &streamFunctionCallNames)
		finished, err := processTokenData(info.RelayMode, data, &responseTextBuilder, &toolCount)
		if finished {
			sawFinishReason = true
		}
		if chunkHasTextDelta(data) {
			sawTextContent = true
		}
		if err != nil {
			logger.LogError(c.Context(), "error processing stream token data: "+err.Error())
			sr.Error(err)
		}
	})

	if fastPath {
		sawFinishReason = observer.sawFinishReason
		sawTextContent = observer.sawTextContent
		toolCount = observer.toolCount
		streamFunctionCallNames = observer.toolNames
		responseTextBuilder.WriteString(observer.responseText.String())
	}
	// Billing needs these after the handler returns: they separate an upstream
	// that died after the answer completed from a mid-answer cut-off, and let
	// the empty-response policy ignore reasoning-only output.
	info.StreamSawFinishReason = sawFinishReason
	if !isAudioModel {
		info.StreamContentObserved = true
		info.StreamSawTextContent = sawTextContent
		info.StreamSawToolCall = toolCount > 0
	}
	if lastFinishReason != "" {
		info.StreamFinishReason = lastFinishReason
	}
	if streamErr != nil && !sawVisibleChunk && !sawFinishReason {
		return nil, streamErr
	}

	// 对音频模型，从倒数第二个stream data中提取usage信息
	if isAudioModel && secondLastStreamData != "" {
		var streamResp struct {
			Usage *dto.Usage `json:"usage"`
		}
		err := common.Unmarshal([]byte(secondLastStreamData), &streamResp)
		if err == nil && streamResp.Usage != nil && relaycommon.ValidUsage(streamResp.Usage) {
			usage = streamResp.Usage
			containStreamUsage = true

			if common.DebugEnabled {
				logger.LogDebug(c.Context(), "Audio model usage extracted from second last SSE: PromptTokens=%d, CompletionTokens=%d, TotalTokens=%d, InputTokens=%d, OutputTokens=%d",
					usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens,
					usage.InputTokens, usage.OutputTokens)
			}
		}
	}

	// #394: the upstream must declare the completion terminated. Without a
	// finish_reason chunk and without the terminal [DONE], the connection died
	// mid-answer. Fabricating the terminal [DONE] below would present a truncated
	// answer as a complete one, so fail the relay instead.
	if streamTruncated(info, sawFinishReason) {
		logger.LogError(c.Context(), fmt.Sprintf("incomplete upstream stream: %s, received=%d",
			info.StreamStatus.Summary(), info.ReceivedResponseCount))
		apiErr := types.NewOpenAIError(
			fmt.Errorf("upstream stream closed before a finish_reason was received (%s)", info.StreamStatus.Summary()),
			types.ErrorCodeBadResponse, http.StatusBadGateway)
		if sawVisibleChunk {
			// Chunks already reached the client on this connection, so the status
			// line is spent and retrying would append a second answer after the
			// partial one. Terminate here with an in-band error event, but keep
			// the delivered output billable as an upstream cut: return the usage
			// instead of an error so the caller settles it at the configured
			// truncated-response multiplier instead of refunding the whole call.
			apiErr = types.NewOpenAIError(apiErr.Err, types.ErrorCodeBadResponse,
				http.StatusBadGateway, types.ErrOptionWithSkipRetry())
			if err := helper.ObjectData(c, map[string]any{"error": apiErr.ToOpenAIError()}); err != nil {
				logger.LogError(c.Context(), "failed to send incomplete-stream error event: "+err.Error())
			}
			info.StreamCutOverride = "upstream"
			if !containStreamUsage {
				usage = relaycommon.ResponseText2Usage(c, responseTextBuilder.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
				usage.CompletionTokens += toolCount * 7
			}
			applyUsagePostProcessing(info, usage, common.StringToByteSlice(lastStreamData))
			for _, name := range streamFunctionCallNames {
				info.CountBillableToolCall(dto.BuildInCallFunctionCall, name)
			}
			return usage, nil
		}
		return nil, apiErr
	}

	// 处理最后的响应（提取 usage / responseId 等；所有 chunk 已即时转发）
	if err := handleLastResponse(lastStreamData, &responseId, &createAt, &systemFingerprint, &model, &usage,
		&containStreamUsage); err != nil {
		logger.LogError(c.Context(), fmt.Sprintf("error handling last response: %s, lastStreamData: [%s]", err.Error(), lastStreamData))
	}

	// A stream can end without ever producing a visible token (an empty
	// completion carrying only finish_reason). Flush whatever preamble is still
	// held so the client sees the terminal chunk before [DONE]. Reached only on
	// the clean-completion path: the truncation guard above returns earlier on
	// failures, keeping a retryable stream byte-clean.
	if heldChunk != "" {
		forwardChunk(heldChunk, nil)
	}

	if !containStreamUsage && fastPath && observer.usage != nil {
		// handleLastResponse only inspects the final chunk. Providers that report
		// usage on an earlier chunk and finish on a later one would otherwise fall
		// back to local estimation even though upstream stated real usage.
		usage = observer.usage
		containStreamUsage = true
	}

	if !containStreamUsage {
		usage = relaycommon.ResponseText2Usage(c, responseTextBuilder.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		usage.CompletionTokens += toolCount * 7
	}

	applyUsagePostProcessing(info, usage, common.StringToByteSlice(lastStreamData))

	for _, name := range streamFunctionCallNames {
		info.CountBillableToolCall(dto.BuildInCallFunctionCall, name)
	}

	HandleFinalResponse(c, info, lastStreamData, responseId, createAt, model, systemFingerprint, usage, containStreamUsage)

	return usage, nil
}

// streamTruncated reports whether an OpenAI-format stream ended without the
// upstream declaring the completion terminated (#394).
//
// A stream is complete when either a chunk carried a non-empty finish_reason or
// the upstream sent the terminal `data: [DONE]` sentinel (end reason done).
// Client disconnects are excluded: the client abandoned the request, so there is
// nothing left to fail, and charging a route for it would be wrong. Only
// OpenAI-format relays are gated; Claude/Gemini conversions terminate through
// their own protocol events in HandleFinalResponse.
func streamTruncated(info *relaycommon.RelayInfo, sawFinishReason bool) bool {
	if info == nil || info.RelayFormat != types.RelayFormatOpenAI {
		return false
	}
	if sawFinishReason {
		return false
	}
	switch info.StreamStatus.GetEndReason() {
	case relaycommon.StreamEndReasonDone, relaycommon.StreamEndReasonClientGone:
		return false
	}
	return true
}

func collectStreamFunctionCallNames(data string, seen map[string]struct{}, names *[]string) {
	var streamResponse dto.ChatCompletionsStreamResponse
	if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
		return
	}
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

func OpenaiHandler(c contract.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	info.ResetStreamObservation()
	defer egress.CloseResponseBodyGracefully(resp)

	var simpleResponse dto.OpenAITextResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	logger.LogDebug(c.Context(), "upstream response body: %s", responseBody)
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
			logger.LogError(c.Context(), fmt.Sprintf("openrouter enterprise response success=false, data: %s", enterpriseResponse.Data))
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

	// A 2xx chat.completion body must carry at least one choice per the OpenAI
	// spec. Unstable resellers disguise upstream failures as 200 + empty
	// choices; mirror the Gemini empty-candidates check and surface both cases
	// as retryable relay errors so the retry loop can pick a healthy route.
	if len(simpleResponse.Choices) == 0 {
		return nil, types.NewOpenAIError(fmt.Errorf("upstream returned 200 with empty choices"), types.ErrorCodeEmptyResponse, http.StatusInternalServerError)
	}
	if info.RelayMode == relayconstant.RelayModeChatCompletions {
		if openAIResponseStructurallyEmpty(simpleResponse) {
			return nil, types.NewOpenAIError(fmt.Errorf("upstream returned 200 without content"), types.ErrorCodeEmptyResponse, http.StatusInternalServerError)
		}
		info.StreamContentObserved = true
		info.StreamFinishReason = simpleResponse.Choices[0].FinishReason
		for _, choice := range simpleResponse.Choices {
			if strings.TrimSpace(choice.Message.StringContent()) != "" {
				info.StreamSawTextContent = true
			}
			if len(choice.Message.ParseToolCalls()) > 0 {
				info.StreamSawToolCall = true
			}
		}
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
				ctkm := relaycommon.CountTextToken(choice.Message.StringContent()+choice.Message.GetReasoningContent(), info.UpstreamModelName)
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
		convertResult, err := relayconvert.ConvertResponse(c.Context(), info, types.RelayFormatClaude, &simpleResponse)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		claudeRespStr, err := common.Marshal(convertResult.Value)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		responseBody = claudeRespStr
	case types.RelayFormatGemini:
		convertResult, err := relayconvert.ConvertResponse(c.Context(), info, types.RelayFormatGemini, &simpleResponse)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		geminiRespStr, err := common.Marshal(convertResult.Value)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		responseBody = geminiRespStr
	}

	egress.IOCopyBytesGracefully(c, resp, responseBody)

	return &simpleResponse.Usage, nil
}

// openAIResponseStructurallyEmpty reports a 200 chat.completion that carries no
// consumable content at all: every choice has empty text, no tool call, no
// reasoning, and did not stop for length or content filtering. Such a response
// is indistinguishable from a disguised upstream failure, so the relay retries
// it instead of billing the user for nothing.
func openAIResponseStructurallyEmpty(response dto.OpenAITextResponse) bool {
	for _, choice := range response.Choices {
		if strings.TrimSpace(choice.Message.StringContent()) != "" {
			return false
		}
		if len(choice.Message.ParseToolCalls()) > 0 {
			return false
		}
		if strings.TrimSpace(choice.Message.GetReasoningContent()) != "" {
			return false
		}
		if choice.Message.Refusal != nil && strings.TrimSpace(*choice.Message.Refusal) != "" {
			return false
		}
		if choice.FinishReason == constant.FinishReasonContentFilter ||
			choice.FinishReason == constant.FinishReasonLength ||
			choice.FinishReason == constant.FinishReasonFunctionCall {
			return false
		}
	}
	return true
}
