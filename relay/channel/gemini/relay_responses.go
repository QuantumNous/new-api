package gemini

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/relayconvert"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func GeminiResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	logger.LogDebug(c, "Gemini responses response body: %s", responseBody)

	var geminiResponse dto.GeminiChatResponse
	if err := common.Unmarshal(responseBody, &geminiResponse); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if len(geminiResponse.Candidates) == 0 {
		usage := buildUsageFromGeminiResponse(c, info, &geminiResponse)
		if geminiResponse.PromptFeedback != nil && geminiResponse.PromptFeedback.BlockReason != nil {
			common.SetContextKey(c, constant.ContextKeyAdminRejectReason, fmt.Sprintf("gemini_block_reason=%s", *geminiResponse.PromptFeedback.BlockReason))
			return &usage, types.NewOpenAIError(
				errors.New("request blocked by Gemini API: "+*geminiResponse.PromptFeedback.BlockReason),
				types.ErrorCodePromptBlocked,
				http.StatusBadRequest,
			)
		}
		common.SetContextKey(c, constant.ContextKeyAdminRejectReason, "gemini_empty_candidates")
		return &usage, types.NewOpenAIError(
			errors.New("empty response from Gemini API"),
			types.ErrorCodeEmptyResponse,
			http.StatusInternalServerError,
		)
	}

	chatResp := responseGeminiChat2OpenAI(c, &geminiResponse)
	chatResp.Model = info.UpstreamModelName
	if responseID := helper.GetResponseID(c); responseID != "" {
		chatResp.Id = responseID
	}
	usage := buildUsageFromGeminiResponse(c, info, &geminiResponse)
	chatResp.Usage = usage

	convertResult, err := relayconvert.ConvertResponse(c, info, types.RelayFormatOpenAIResponses, chatResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	responsesResp, ok := convertResult.Value.(*dto.OpenAIResponsesResponse)
	if !ok {
		return nil, types.NewOpenAIError(fmt.Errorf("expected OpenAI responses response, got %T", convertResult.Value), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	responsesUsage := convertResult.Usage
	if responsesUsage == nil || responsesUsage.TotalTokens == 0 {
		responsesResp.Usage = relayconvert.UsageFromChatUsage(&usage)
	}

	responseBody, err = common.Marshal(responsesResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}
	service.IOCopyBytesGracefully(c, resp, responseBody)
	return &usage, nil
}

func GeminiResponsesStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(errors.New("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	responseID := helper.GetResponseID(c)
	created := common.GetTimestamp()
	state, err := relayconvert.NewResponseStreamState(types.RelayFormatOpenAI, types.RelayFormatOpenAIResponses, relayconvert.ResponseStreamOptions{
		ID:      responseID,
		Model:   info.UpstreamModelName,
		Created: created,
	})
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	finishReason := constant.FinishReasonStop
	toolCallIndexByChoice := make(map[int]map[string]int)
	nextToolCallIndexByChoice := make(map[int]int)
	var streamErr *types.NewAPIError
	streamFailureReason := relaycommon.StreamEndReasonInternalError
	streamWriter := openai.NewResponsesStreamWriter(c)
	hasMeaningfulStreamData := false

	sendEvent := func(event relayconvert.ChatToResponsesStreamEvent) bool {
		data, err := common.Marshal(event.Payload)
		if err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
			return false
		}
		if err := streamWriter.WriteData(event.Type, string(data)); err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
			if contextErr := c.Request.Context().Err(); contextErr != nil {
				info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonClientGone, contextErr, "gemini_responses_write")
			}
			return false
		}
		if event.Type != "response.created" {
			hasMeaningfulStreamData = true
		}
		return true
	}
	sendChunk := func(chunk *dto.ChatCompletionsStreamResponse) bool {
		results, err := relayconvert.ConvertStreamResponseChunk(c, info, state, chunk)
		if err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
			return false
		}
		for _, result := range results {
			event, ok := result.Value.(relayconvert.ChatToResponsesStreamEvent)
			if !ok {
				streamErr = types.NewOpenAIError(fmt.Errorf("expected OAI responses stream event, got %T", result.Value), types.ErrorCodeBadResponse, http.StatusInternalServerError)
				return false
			}
			if !sendEvent(event) {
				return false
			}
		}
		return true
	}

	usage, streamAPIError := geminiStreamHandler(c, info, resp, func(data string, geminiResponse *dto.GeminiChatResponse) bool {
		if len(geminiResponse.Candidates) == 0 {
			if geminiResponse.PromptFeedback != nil && geminiResponse.PromptFeedback.BlockReason != nil {
				streamErr = types.NewOpenAIError(
					errors.New("request blocked by Gemini API: "+*geminiResponse.PromptFeedback.BlockReason),
					types.ErrorCodePromptBlocked,
					http.StatusBadRequest,
				)
				streamFailureReason = relaycommon.StreamEndReasonTerminalClientError
				return false
			}
			if !dto.HasGeminiUsageMetadataTokens(geminiResponse.GetUsageMetadata()) {
				common.SetContextKey(c, constant.ContextKeyAdminRejectReason, "gemini_empty_candidates")
				streamErr = types.NewOpenAIError(
					errors.New("empty response from Gemini API"),
					types.ErrorCodeEmptyResponse,
					http.StatusInternalServerError,
				)
				streamFailureReason = relaycommon.StreamEndReasonUpstreamFailed
				return false
			}
		}

		response, isStop := streamResponseGeminiChat2OpenAI(geminiResponse)
		if isStop || dto.HasGeminiUsageMetadataTokens(geminiResponse.GetUsageMetadata()) {
			hasMeaningfulStreamData = true
		}
		response.Id = responseID
		response.Created = created
		response.Model = info.UpstreamModelName

		if response.IsToolCall() {
			finishReason = constant.FinishReasonToolCalls
		}
		for choiceIdx := range response.Choices {
			choiceKey := response.Choices[choiceIdx].Index
			for toolIdx := range response.Choices[choiceIdx].Delta.ToolCalls {
				tool := &response.Choices[choiceIdx].Delta.ToolCalls[toolIdx]
				if tool.ID == "" {
					continue
				}
				indexByID := toolCallIndexByChoice[choiceKey]
				if indexByID == nil {
					indexByID = make(map[string]int)
					toolCallIndexByChoice[choiceKey] = indexByID
				}
				if idx, ok := indexByID[tool.ID]; ok {
					tool.SetIndex(idx)
					continue
				}
				idx := nextToolCallIndexByChoice[choiceKey]
				nextToolCallIndexByChoice[choiceKey] = idx + 1
				indexByID[tool.ID] = idx
				tool.SetIndex(idx)
			}
		}

		if !sendChunk(response) {
			return false
		}
		if isStop {
			return sendChunk(helper.GenerateStopResponse(responseID, created, info.UpstreamModelName, finishReason))
		}
		return true
	})
	if streamAPIError != nil && streamErr == nil {
		streamErr = streamAPIError
		openAIError := streamAPIError.ToOpenAIError()
		if openai.IsResponsesChannelFailure(&openAIError) {
			streamFailureReason = relaycommon.StreamEndReasonUpstreamFailed
		} else {
			streamFailureReason = relaycommon.StreamEndReasonTerminalClientError
		}
	}

	if usage != nil {
		state.SetUsage(usage)
	}
	snapshot := info.StreamStatus.Snapshot()
	if contextErr := c.Request.Context().Err(); contextErr != nil {
		if !streamWriter.TerminalWritten() {
			info.StreamStatus.OverrideEndReasonIfNoProtocolTerminal(relaycommon.StreamEndReasonClientGone, contextErr, "gemini_responses_post_scanner")
		}
		return usage, nil
	}
	if streamErr == nil {
		switch snapshot.EndReason {
		case relaycommon.StreamEndReasonTimeout, relaycommon.StreamEndReasonScannerErr, relaycommon.StreamEndReasonPingFail:
			errorCode := types.ErrorCodeBadResponse
			if snapshot.EndError != nil && strings.Contains(snapshot.EndError.Error(), "unmarshal:") {
				errorCode = types.ErrorCodeBadResponseBody
			}
			streamEndErr := snapshot.EndError
			if streamEndErr == nil {
				streamEndErr = fmt.Errorf("Gemini stream ended: %s", snapshot.EndReason)
			}
			streamErr = types.NewOpenAIError(streamEndErr, errorCode, http.StatusInternalServerError)
			streamFailureReason = relaycommon.StreamEndReasonUpstreamFailed
		case relaycommon.StreamEndReasonPanic, relaycommon.StreamEndReasonHandlerStop:
			errorCode := types.ErrorCodeBadResponse
			streamEndErr := snapshot.EndError
			if streamEndErr != nil && strings.Contains(streamEndErr.Error(), "unmarshal:") {
				errorCode = types.ErrorCodeBadResponseBody
				streamFailureReason = relaycommon.StreamEndReasonUpstreamFailed
			} else {
				streamFailureReason = relaycommon.StreamEndReasonInternalError
			}
			if streamEndErr == nil {
				streamEndErr = fmt.Errorf("Gemini stream ended: %s", snapshot.EndReason)
			}
			streamErr = types.NewOpenAIError(streamEndErr, errorCode, http.StatusInternalServerError)
		}
	}
	if streamErr == nil && !hasMeaningfulStreamData {
		streamErr = types.NewOpenAIError(errors.New("empty response from Gemini stream"), types.ErrorCodeEmptyResponse, http.StatusBadGateway)
		streamFailureReason = relaycommon.StreamEndReasonUpstreamFailed
	}

	if streamErr == nil {
		finalResults, finalizeErr := relayconvert.FinalizeStreamResponse(c, info, state)
		if finalizeErr != nil {
			streamErr = types.NewOpenAIError(finalizeErr, types.ErrorCodeBadResponse, http.StatusInternalServerError)
		} else {
			for _, result := range finalResults {
				event, ok := result.Value.(relayconvert.ChatToResponsesStreamEvent)
				if !ok {
					streamErr = types.NewOpenAIError(fmt.Errorf("expected OAI responses stream event, got %T", result.Value), types.ErrorCodeBadResponse, http.StatusInternalServerError)
					break
				}
				if !sendEvent(event) {
					break
				}
			}
		}
	}
	if streamErr == nil {
		return usage, nil
	}
	if contextErr := c.Request.Context().Err(); contextErr != nil {
		if !streamWriter.TerminalWritten() {
			info.StreamStatus.OverrideEndReasonIfNoProtocolTerminal(relaycommon.StreamEndReasonClientGone, contextErr, "gemini_responses_terminal")
		}
		return usage, nil
	}
	if terminalType, retried, retryErr := streamWriter.RetryPendingTerminal(); retried {
		if retryErr != nil {
			if contextErr := c.Request.Context().Err(); contextErr != nil {
				info.StreamStatus.OverrideEndReasonIfNoProtocolTerminal(relaycommon.StreamEndReasonClientGone, contextErr, "gemini_responses_terminal_retry")
			} else {
				info.StreamStatus.OverrideEndReasonIfNoProtocolTerminal(relaycommon.StreamEndReasonInternalError, retryErr, "gemini_responses_terminal_retry")
			}
			info.StreamStatus.RecordError(retryErr.Error())
			return usage, nil
		}
		endReason := relaycommon.StreamEndReasonDone
		var endErr error
		if terminalType == "response.failed" {
			endReason = streamFailureReason
			endErr = streamErr
		}
		info.StreamStatus.SetProtocolTerminalEndReasonWithSource(endReason, endErr, "gemini_responses_terminal_retry")
		return usage, nil
	}
	if !streamWriter.Started() {
		return usage, streamErr
	}
	if !streamWriter.TerminalWritten() {
		openAIError := streamErr.ToOpenAIError()
		if err := streamWriter.WriteFailure(responseID, info.UpstreamModelName, created, usage, &openAIError); err != nil {
			if _, retried, retryErr := streamWriter.RetryPendingTerminal(); retried && retryErr == nil {
				info.StreamStatus.SetProtocolTerminalEndReasonWithSource(streamFailureReason, streamErr, "gemini_responses_terminal_retry")
				return usage, nil
			} else if retryErr != nil {
				err = retryErr
			}
			logger.LogError(c, "failed to write Gemini Responses terminal error: "+err.Error())
			if contextErr := c.Request.Context().Err(); contextErr != nil {
				info.StreamStatus.OverrideEndReasonIfNoProtocolTerminal(relaycommon.StreamEndReasonClientGone, contextErr, "gemini_responses_terminal_write")
			} else {
				info.StreamStatus.OverrideEndReasonIfNoProtocolTerminal(relaycommon.StreamEndReasonInternalError, err, "gemini_responses_terminal_write")
			}
			info.StreamStatus.RecordError(err.Error())
			return usage, nil
		}
	}
	info.StreamStatus.SetProtocolTerminalEndReasonWithSource(streamFailureReason, streamErr, "gemini_responses_terminal")
	return usage, nil
}
