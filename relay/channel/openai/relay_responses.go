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
			applyResponsesTerminalUsage(c, usage, streamResponse.Response)
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
		case "response.output_text.delta",
			"response.reasoning_summary_text.delta",
			"response.reasoning_text.delta",
			"response.function_call_arguments.delta",
			"response.custom_tool_call_input.delta",
			"response.mcp_call_arguments.delta",
			"response.code_interpreter_call_code.delta":
			// Preserve a text-equivalent fallback when a failed terminal event
			// omits usage, including tool-only and reasoning-only output.
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
		} else {
			finalizeResponsesUsage(usage, &responseTextBuilder, info)
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

	finalizeResponsesUsage(usage, &responseTextBuilder, info)

	return usage, nil
}

func finalizeResponsesUsage(usage *dto.Usage, responseTextBuilder *strings.Builder, info *relaycommon.RelayInfo) {
	if usage.CompletionTokens == 0 && responseTextBuilder.Len() > 0 {
		usage.CompletionTokens = service.CountTextToken(responseTextBuilder.String(), info.UpstreamModelName)
	}
	if usage.PromptTokens == 0 && usage.CompletionTokens != 0 {
		usage.PromptTokens = info.GetEstimatePromptTokens()
	}
	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
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
			return types.WithOpenAIError(*openAIError, codexResponsesFailedStatus(openAIError), options...)
		}
	}
	return types.NewOpenAIError(
		errors.New("codex upstream response failed"),
		types.ErrorCodeBadResponse,
		http.StatusInternalServerError,
		options...,
	)
}

func codexResponsesFailedStatus(openAIError *types.OpenAIError) int {
	if openAIError == nil {
		return http.StatusInternalServerError
	}
	errorType := strings.ToLower(strings.TrimSpace(openAIError.Type))
	errorCode := strings.ToLower(strings.TrimSpace(common.Interface2String(openAIError.Code)))
	if statusCode := codexResponsesFailedIdentifierStatus(errorCode); statusCode != 0 {
		return statusCode
	}
	if statusCode := codexResponsesFailedIdentifierStatus(errorType); statusCode != 0 {
		return statusCode
	}
	return http.StatusInternalServerError
}

func codexResponsesFailedIdentifierStatus(identifier string) int {
	switch identifier {
	case
		"insufficient_quota",
		"credit_balance_exhausted",
		"organization_spend_limit_exceeded",
		"project_spend_limit_exceeded",
		"organization_usage_limit_exceeded",
		"project_usage_limit_exceeded",
		"rate_limit_error",
		"rate_limit_exceeded":
		return http.StatusTooManyRequests
	case "permission_error", "permission_denied", "unsupported_country_region_territory":
		return http.StatusForbidden
	case "authentication_error", "invalid_api_key":
		return http.StatusUnauthorized
	case "invalid_request_error",
		"invalid_request",
		"bad_request",
		"invalid_prompt",
		"content_policy_violation",
		"data_residency_mismatch",
		"bio_policy",
		"invalid_image",
		"invalid_image_format",
		"invalid_base64_image",
		"invalid_image_url",
		"image_too_large",
		"image_too_small",
		"image_parse_error",
		"image_content_policy_violation",
		"invalid_image_mode",
		"image_file_too_large",
		"unsupported_image_media_type",
		"empty_image_file",
		"failed_to_download_image",
		"image_file_not_found":
		return http.StatusBadRequest
	case "overloaded_error", "overloaded", "service_unavailable":
		return http.StatusServiceUnavailable
	case "server_error":
		return http.StatusInternalServerError
	default:
		return 0
	}
}
