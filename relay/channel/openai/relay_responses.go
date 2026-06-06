package openai

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const (
	responsesStreamEventCompleted  = "response.completed"
	responsesStreamEventCreated    = "response.created"
	responsesStreamEventError      = "response.error"
	responsesStreamEventFailed     = "response.failed"
	responsesStreamEventInProgress = "response.in_progress"
	responsesStreamEventTextDelta  = "response.output_text.delta"
)

type responsesStreamDataEvent struct {
	Response dto.ResponsesStreamResponse
	Data     string
}

type responsesStreamErrorPayload struct {
	Error types.OpenAIError `json:"error"`
}

func OaiResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	// read response body
	var responsesResponse dto.OpenAIResponsesResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	err = common.Unmarshal(responseBody, &responsesResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if oaiError := responsesResponse.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}
	relaycommon.ObserveResponsesTranscriptReplayResponseBody(info, responseBody)

	if responsesResponse.HasImageGenerationCall() {
		c.Set("image_generation_call", true)
		c.Set("image_generation_call_quality", responsesResponse.GetQuality())
		c.Set("image_generation_call_size", responsesResponse.GetSize())
	}

	// 写入新的 response body
	service.IOCopyBytesGracefully(c, resp, responseBody)

	// compute usage
	usage := dto.Usage{}
	if responsesResponse.Usage != nil {
		usage.PromptTokens = responsesResponse.Usage.InputTokens
		usage.CompletionTokens = responsesResponse.Usage.OutputTokens
		usage.TotalTokens = responsesResponse.Usage.TotalTokens
		if responsesResponse.Usage.InputTokensDetails != nil {
			usage.PromptTokensDetails.CachedTokens = responsesResponse.Usage.InputTokensDetails.CachedTokens
		}
	}
	if info == nil || info.ResponsesUsageInfo == nil || info.ResponsesUsageInfo.BuiltInTools == nil {
		return &usage, nil
	}
	// 解析 Tools 用量
	for _, tool := range responsesResponse.Tools {
		buildToolinfo, ok := info.ResponsesUsageInfo.BuiltInTools[common.Interface2String(tool["type"])]
		if !ok || buildToolinfo == nil {
			logger.LogError(c, fmt.Sprintf("BuiltInTools not found for tool type: %v", tool["type"]))
			continue
		}
		buildToolinfo.CallCount++
	}
	return &usage, nil
}

func OaiResponsesStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		logger.LogError(c, "invalid response or response body")
		return nil, types.NewError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse)
	}

	defer service.CloseResponseBodyGracefully(resp)

	var usage = &dto.Usage{}
	var responseTextBuilder strings.Builder
	var streamErr *types.NewAPIError
	var sentDownstream bool
	var pendingPrelude []responsesStreamDataEvent

	flushPendingPrelude := func() {
		for _, event := range pendingPrelude {
			sendResponsesStreamData(c, event.Response, event.Data)
			sentDownstream = true
		}
		pendingPrelude = nil
	}

	sendStreamData := func(streamResponse dto.ResponsesStreamResponse, data string) {
		if shouldBufferResponsesStreamPrelude(info, streamResponse.Type, sentDownstream) {
			pendingPrelude = append(pendingPrelude, responsesStreamDataEvent{
				Response: streamResponse,
				Data:     data,
			})
			return
		}
		flushPendingPrelude()
		sendResponsesStreamData(c, streamResponse, data)
		sentDownstream = true
	}

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {

		// 检查当前数据是否包含 completed 状态和 usage 信息
		var streamResponse dto.ResponsesStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			logger.LogError(c, "failed to unmarshal stream response: "+err.Error())
			sr.Error(err)
			return
		}
		relaycommon.ObserveResponsesTranscriptReplayStreamEvent(info, data)
		if isResponsesStreamTerminalError(streamResponse.Type) {
			openAIError := responsesStreamOpenAIError(streamResponse)
			streamErr = types.WithOpenAIError(openAIError, http.StatusInternalServerError)
			logResponsesStreamTerminalError(c, info, streamResponse.Type, openAIError)
			if !shouldDeferResponsesStreamErrorForReplay(info, openAIError, sentDownstream) {
				flushPendingPrelude()
				if sendErr := sendResponsesStreamErrorData(c, openAIError); sendErr != nil {
					streamErr = types.NewOpenAIError(sendErr, types.ErrorCodeBadResponse, http.StatusInternalServerError)
				} else {
					sentDownstream = true
				}
			}
			sr.Stop(streamErr)
			return
		}

		sendStreamData(streamResponse, data)
		switch streamResponse.Type {
		case responsesStreamEventCompleted:
			if streamResponse.Response != nil {
				if streamResponse.Response.Usage != nil {
					if streamResponse.Response.Usage.InputTokens != 0 {
						usage.PromptTokens = streamResponse.Response.Usage.InputTokens
					}
					if streamResponse.Response.Usage.OutputTokens != 0 {
						usage.CompletionTokens = streamResponse.Response.Usage.OutputTokens
					}
					if streamResponse.Response.Usage.TotalTokens != 0 {
						usage.TotalTokens = streamResponse.Response.Usage.TotalTokens
					}
					if streamResponse.Response.Usage.InputTokensDetails != nil {
						usage.PromptTokensDetails.CachedTokens = streamResponse.Response.Usage.InputTokensDetails.CachedTokens
					}
				}
				if streamResponse.Response.HasImageGenerationCall() {
					c.Set("image_generation_call", true)
					c.Set("image_generation_call_quality", streamResponse.Response.GetQuality())
					c.Set("image_generation_call_size", streamResponse.Response.GetSize())
				}
			}
		case responsesStreamEventTextDelta:
			// 处理输出文本
			responseTextBuilder.WriteString(streamResponse.Delta)
		case dto.ResponsesOutputTypeItemDone:
			// 函数调用处理
			if streamResponse.Item != nil {
				switch streamResponse.Item.Type {
				case dto.BuildInCallWebSearchCall:
					if info != nil && info.ResponsesUsageInfo != nil && info.ResponsesUsageInfo.BuiltInTools != nil {
						if webSearchTool, exists := info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolWebSearchPreview]; exists && webSearchTool != nil {
							webSearchTool.CallCount++
						}
					}
				}
			}
		}
	})

	if streamErr != nil {
		return nil, streamErr
	}
	flushPendingPrelude()

	if usage.CompletionTokens == 0 {
		// 计算输出文本的 token 数量
		tempStr := responseTextBuilder.String()
		if len(tempStr) > 0 {
			// 非正常结束，使用输出文本的 token 数量
			completionTokens := service.CountTextToken(tempStr, info.UpstreamModelName)
			usage.CompletionTokens = completionTokens
		}
	}

	if usage.PromptTokens == 0 && usage.CompletionTokens != 0 {
		usage.PromptTokens = info.GetEstimatePromptTokens()
	}

	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens

	return usage, nil
}

func isResponsesStreamTerminalError(eventType string) bool {
	return eventType == responsesStreamEventError || eventType == responsesStreamEventFailed
}

func isResponsesStreamPrelude(eventType string) bool {
	return eventType == responsesStreamEventCreated || eventType == responsesStreamEventInProgress
}

func shouldBufferResponsesStreamPrelude(info *relaycommon.RelayInfo, eventType string, sentDownstream bool) bool {
	if sentDownstream || !isResponsesStreamPrelude(eventType) {
		return false
	}
	return info != nil && info.ResponsesTranscriptReplay != nil && !info.ResponsesTranscriptReplay.Replayed
}

func responsesStreamOpenAIError(streamResponse dto.ResponsesStreamResponse) types.OpenAIError {
	if streamResponse.Response != nil {
		if openAIError := streamResponse.Response.GetOpenAIError(); openAIError != nil {
			if openAIError.Message != "" || openAIError.Type != "" || openAIError.Code != nil {
				return *openAIError
			}
		}
	}
	return types.OpenAIError{
		Message: fmt.Sprintf("responses stream terminal event: %s", streamResponse.Type),
		Type:    string(types.ErrorCodeBadResponse),
		Code:    string(types.ErrorCodeBadResponse),
	}
}

func shouldDeferResponsesStreamErrorForReplay(info *relaycommon.RelayInfo, openAIError types.OpenAIError, sentDownstream bool) bool {
	if sentDownstream || info == nil || info.ResponsesTranscriptReplay == nil || info.ResponsesTranscriptReplay.Replayed {
		return false
	}
	body, err := common.Marshal(responsesStreamErrorPayload{Error: openAIError})
	if err != nil {
		return false
	}
	return relaycommon.IsResponsesTranscriptReplayError(http.StatusBadRequest, body)
}

func sendResponsesStreamErrorData(c *gin.Context, openAIError types.OpenAIError) error {
	payload, err := common.Marshal(responsesStreamErrorPayload{Error: openAIError})
	if err != nil {
		return err
	}
	c.Render(-1, common.CustomEvent{Data: "event: error\n"})
	c.Render(-1, common.CustomEvent{Data: "data: " + string(payload)})
	return helper.FlushWriter(c)
}

func logResponsesStreamTerminalError(c *gin.Context, info *relaycommon.RelayInfo, eventType string, openAIError types.OpenAIError) {
	channelID := 0
	if info != nil {
		channelID = info.ChannelId
	}
	logger.LogError(c, fmt.Sprintf(
		"responses stream terminal event on channel #%d: event=%s error_type=%s code=%v message=%s",
		channelID,
		eventType,
		openAIError.Type,
		openAIError.Code,
		truncateResponsesStreamErrorMessage(openAIError.Message),
	))
}

func truncateResponsesStreamErrorMessage(message string) string {
	const maxMessageBytes = 512
	if len(message) <= maxMessageBytes {
		return message
	}
	return message[:maxMessageBytes] + "...(truncated)"
}
