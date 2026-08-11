package openai

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
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

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
	if responsesResponse.ID != "" {
		c.Set(common.UpstreamResponseIdKey, responsesResponse.ID)
	}

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
			usage.PromptTokensDetails.CacheWriteTokens = responsesResponse.Usage.InputTokensDetails.CacheWriteTokens
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
	var terminalErr *types.NewAPIError
	var retryableTerminalFailure bool

	var responseHeaderSnapshot http.Header
	var eventStreamHeadersValue any
	var hadEventStreamHeaders bool
	if info.ChannelType == constant.ChannelTypeCodex {
		responseHeaderSnapshot = c.Writer.Header().Clone()
		eventStreamHeadersValue, hadEventStreamHeaders = c.Get("event_stream_headers_set")
	}

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {

		// 检查当前数据是否包含 completed 状态和 usage 信息
		var streamResponse dto.ResponsesStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			logger.LogError(c, "failed to unmarshal stream response: "+err.Error())
			sr.Error(err)
			return
		}
		if streamResponse.Response != nil && streamResponse.Response.ID != "" {
			c.Set(common.UpstreamResponseIdKey, streamResponse.Response.ID)
		}
		if info.ChannelType == constant.ChannelTypeCodex && streamResponse.Type == "response.failed" {
			responseWritten := c.Writer.Written()
			if responseWritten {
				sendResponsesStreamData(c, streamResponse, data)
			}
			retryableTerminalFailure = !responseWritten
			terminalErr = newCodexResponsesFailedError(streamResponse.Response, responseWritten)
			sr.Stop(terminalErr)
			return
		}
		sendResponsesStreamData(c, streamResponse, data)
		switch streamResponse.Type {
		case "response.completed", "response.incomplete":
			applyResponsesTerminalUsage(c, usage, streamResponse.Response)
		case "response.done":
			if info.ChannelType == constant.ChannelTypeCodex {
				applyResponsesTerminalUsage(c, usage, streamResponse.Response)
			}
		case "response.output_text.delta":
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
	if terminalErr != nil {
		if retryableTerminalFailure {
			restoreResponsesStreamAttemptState(c, info, responseHeaderSnapshot, eventStreamHeadersValue, hadEventStreamHeaders)
		}
		return usage, terminalErr
	}

	// FRT watchdog: upstream accepted the request but never produced a data
	// event within constant.StreamingFirstResponseTimeout seconds. Surface as
	// a channel-class error so controller/relay.go retry loop tries the next
	// channel. Safe to retry only when nothing has been written to the client
	// yet (no SetFirstResponseTime + no PingData) — by default
	// PingIntervalEnabled is false, so we satisfy this when FirstResponseTime
	// is still zero.
	if info.StreamStatus != nil &&
		info.StreamStatus.EndReason == relaycommon.StreamEndReasonFirstResponseTimeout &&
		!info.HasSendResponse() {
		return nil, types.NewError(
			fmt.Errorf("upstream did not send first response token within %ds", constant.StreamingFirstResponseTimeout),
			types.ErrorCodeChannelResponseTimeExceeded,
		)
	}

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

func restoreResponsesStreamAttemptState(
	c *gin.Context,
	info *relaycommon.RelayInfo,
	headerSnapshot http.Header,
	eventStreamHeadersValue any,
	hadEventStreamHeaders bool,
) {
	header := c.Writer.Header()
	clear(header)
	for key, values := range headerSnapshot {
		header[key] = append([]string(nil), values...)
	}
	if hadEventStreamHeaders {
		c.Set("event_stream_headers_set", eventStreamHeadersValue)
	} else if c.Keys != nil {
		delete(c.Keys, "event_stream_headers_set")
	}
	info.ResetStreamResponseStateForRetry()
}

func applyResponsesTerminalUsage(c *gin.Context, usage *dto.Usage, response *dto.OpenAIResponsesResponse) {
	if usage == nil || response == nil {
		return
	}
	if response.Usage != nil {
		if response.Usage.InputTokens != 0 {
			usage.PromptTokens = response.Usage.InputTokens
		}
		if response.Usage.OutputTokens != 0 {
			usage.CompletionTokens = response.Usage.OutputTokens
		}
		if response.Usage.TotalTokens != 0 {
			usage.TotalTokens = response.Usage.TotalTokens
		}
		if response.Usage.InputTokensDetails != nil {
			usage.PromptTokensDetails.CachedTokens = response.Usage.InputTokensDetails.CachedTokens
			usage.PromptTokensDetails.CacheWriteTokens = response.Usage.InputTokensDetails.CacheWriteTokens
		}
	}
	if response.HasImageGenerationCall() {
		c.Set("image_generation_call", true)
		c.Set("image_generation_call_quality", response.GetQuality())
		c.Set("image_generation_call_size", response.GetSize())
	}
}

func newCodexResponsesFailedError(response *dto.OpenAIResponsesResponse, skipRetry bool) *types.NewAPIError {
	options := make([]types.NewAPIErrorOptions, 0, 1)
	if skipRetry {
		options = append(options, types.ErrOptionWithSkipRetry())
	}
	if response != nil {
		if openAIError := response.GetOpenAIError(); openAIError != nil && openAIError.Message != "" {
			return types.WithOpenAIError(*openAIError, http.StatusInternalServerError, options...)
		}
	}
	return types.NewOpenAIError(
		errors.New("codex upstream response failed"),
		types.ErrorCodeBadResponse,
		http.StatusInternalServerError,
		options...,
	)
}
