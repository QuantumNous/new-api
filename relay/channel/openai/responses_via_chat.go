package openai

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/relayconvert"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func OaiChatToResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	defer service.CloseResponseBodyGracefully(resp)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	var chatResp dto.OpenAITextResponse
	if err := common.Unmarshal(body, &chatResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if oaiError := chatResp.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}

	if responseID := helper.GetResponseID(c); responseID != "" {
		chatResp.Id = responseID
	}
	convertResult, err := relayconvert.ConvertResponse(c, info, types.RelayFormatOpenAIResponses, &chatResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	responsesResp, ok := convertResult.Value.(*dto.OpenAIResponsesResponse)
	if !ok {
		return nil, types.NewOpenAIError(fmt.Errorf("expected OpenAI responses response, got %T", convertResult.Value), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	usage := convertResult.Usage
	if usage == nil || usage.TotalTokens == 0 {
		text := service.ExtractOutputTextFromResponses(responsesResp)
		usage = service.ResponseText2Usage(c, text, info.UpstreamModelName, info.GetEstimatePromptTokens())
		responsesResp.Usage = relayconvert.UsageFromChatUsage(usage)
	}

	responseBody, err := common.Marshal(responsesResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)
	return usage, nil
}

func OaiChatToResponsesStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	defer service.CloseResponseBodyGracefully(resp)

	responseID := helper.GetResponseID(c)
	createdAt := common.GetTimestamp()
	state, err := relayconvert.NewResponseStreamState(types.RelayFormatOpenAI, types.RelayFormatOpenAIResponses, relayconvert.ResponseStreamOptions{
		ID:      responseID,
		Model:   info.UpstreamModelName,
		Created: createdAt,
	})
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	streamErr := (*types.NewAPIError)(nil)
	streamFailureReason := relaycommon.StreamEndReasonInternalError
	streamWriter := NewResponsesStreamWriter(c)
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
				info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonClientGone, contextErr, "responses_bridge_write")
			}
			return false
		}
		if event.Type != "response.created" {
			hasMeaningfulStreamData = true
		}
		return true
	}

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		if streamErr != nil {
			sr.Stop(streamErr)
			return
		}

		var errorResp dto.OpenAITextResponse
		if err := common.UnmarshalJsonStr(data, &errorResp); err == nil {
			if oaiError := errorResp.GetOpenAIError(); oaiError != nil && (oaiError.Type != "" || oaiError.Message != "" || oaiError.Code != nil) {
				channelFailure := IsResponsesChannelFailure(oaiError)
				statusCode := http.StatusBadRequest
				if channelFailure {
					statusCode = http.StatusBadGateway
				}
				streamErr = types.WithOpenAIError(*oaiError, statusCode)
				if channelFailure {
					streamFailureReason = relaycommon.StreamEndReasonUpstreamFailed
				} else {
					streamFailureReason = relaycommon.StreamEndReasonTerminalClientError
				}
				sr.Stop(streamErr)
				return
			}
		}

		var chunk dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &chunk); err != nil {
			logger.LogError(c, "failed to unmarshal chat stream response: "+err.Error())
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
			streamFailureReason = relaycommon.StreamEndReasonUpstreamFailed
			sr.Stop(streamErr)
			return
		}
		if chunk.IsFinished() || dto.HasOpenAIUsageTokens(chunk.Usage) {
			hasMeaningfulStreamData = true
		}

		results, err := relayconvert.ConvertStreamResponseChunk(c, info, state, &chunk)
		if err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
			sr.Stop(streamErr)
			return
		}
		for _, result := range results {
			event, ok := result.Value.(relayconvert.ChatToResponsesStreamEvent)
			if !ok {
				streamErr = types.NewOpenAIError(fmt.Errorf("expected OAI responses stream event, got %T", result.Value), types.ErrorCodeBadResponse, http.StatusInternalServerError)
				sr.Stop(streamErr)
				return
			}
			if !sendEvent(event) {
				sr.Stop(streamErr)
				return
			}
		}
	})

	usage := state.Usage()
	if usage == nil || usage.TotalTokens == 0 {
		usage = service.ResponseText2Usage(c, state.UsageText(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		state.SetUsage(usage)
	}
	if contextErr := c.Request.Context().Err(); contextErr != nil {
		if !streamWriter.TerminalWritten() {
			info.StreamStatus.OverrideEndReasonIfNoProtocolTerminal(relaycommon.StreamEndReasonClientGone, contextErr, "responses_bridge_post_scanner")
		}
		return usage, nil
	}

	snapshot := info.StreamStatus.Snapshot()
	if streamErr == nil {
		switch snapshot.EndReason {
		case relaycommon.StreamEndReasonTimeout, relaycommon.StreamEndReasonScannerErr, relaycommon.StreamEndReasonPingFail:
			streamEndErr := snapshot.EndError
			if streamEndErr == nil {
				streamEndErr = fmt.Errorf("chat stream ended: %s", snapshot.EndReason)
			}
			streamErr = types.NewOpenAIError(streamEndErr, types.ErrorCodeBadResponse, http.StatusBadGateway)
			streamFailureReason = relaycommon.StreamEndReasonUpstreamFailed
		case relaycommon.StreamEndReasonPanic, relaycommon.StreamEndReasonHandlerStop:
			streamEndErr := snapshot.EndError
			if streamEndErr == nil {
				streamEndErr = fmt.Errorf("chat stream ended: %s", snapshot.EndReason)
			}
			streamErr = types.NewOpenAIError(streamEndErr, types.ErrorCodeBadResponse, http.StatusInternalServerError)
			streamFailureReason = relaycommon.StreamEndReasonInternalError
		}
	}
	if streamErr == nil && !hasMeaningfulStreamData {
		streamErr = types.NewOpenAIError(errors.New("empty response from upstream chat stream"), types.ErrorCodeEmptyResponse, http.StatusBadGateway)
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

	snapshot = info.StreamStatus.Snapshot()
	if contextErr := c.Request.Context().Err(); contextErr != nil {
		if !streamWriter.TerminalWritten() {
			info.StreamStatus.OverrideEndReasonIfNoProtocolTerminal(relaycommon.StreamEndReasonClientGone, contextErr, "responses_bridge_terminal")
		}
		return usage, nil
	}
	if terminalType, retried, retryErr := streamWriter.RetryPendingTerminal(); retried {
		if retryErr != nil {
			if contextErr := c.Request.Context().Err(); contextErr != nil {
				info.StreamStatus.OverrideEndReasonIfNoProtocolTerminal(relaycommon.StreamEndReasonClientGone, contextErr, "responses_bridge_terminal_retry")
			} else {
				info.StreamStatus.OverrideEndReasonIfNoProtocolTerminal(relaycommon.StreamEndReasonInternalError, retryErr, "responses_bridge_terminal_retry")
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
		info.StreamStatus.SetProtocolTerminalEndReasonWithSource(endReason, endErr, "responses_bridge_terminal_retry")
		return usage, nil
	}
	if !streamWriter.Started() {
		return usage, streamErr
	}
	if !streamWriter.TerminalWritten() {
		openAIError := streamErr.ToOpenAIError()
		if err := streamWriter.WriteFailure(responseID, info.UpstreamModelName, createdAt, usage, &openAIError); err != nil {
			if _, retried, retryErr := streamWriter.RetryPendingTerminal(); retried && retryErr == nil {
				info.StreamStatus.SetProtocolTerminalEndReasonWithSource(streamFailureReason, streamErr, "responses_bridge_terminal_retry")
				return usage, nil
			} else if retryErr != nil {
				err = retryErr
			}
			logger.LogError(c, "failed to write Responses bridge terminal error: "+err.Error())
			if contextErr := c.Request.Context().Err(); contextErr != nil {
				info.StreamStatus.OverrideEndReasonIfNoProtocolTerminal(relaycommon.StreamEndReasonClientGone, contextErr, "responses_bridge_terminal_write")
			} else {
				info.StreamStatus.OverrideEndReasonIfNoProtocolTerminal(relaycommon.StreamEndReasonInternalError, err, "responses_bridge_terminal_write")
			}
			info.StreamStatus.RecordError(err.Error())
			return usage, nil
		}
	}
	info.StreamStatus.SetProtocolTerminalEndReasonWithSource(streamFailureReason, streamErr, "responses_bridge_terminal")

	return usage, nil
}
