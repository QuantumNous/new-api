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
		usage.CompletionTokenDetails.ReasoningTokens = responsesResponse.Usage.ResolveReasoningTokens()
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
	streamCtx := newResponsesStreamCtx()

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {

		// 检查当前数据是否包含 completed 状态和 usage 信息
		var streamResponse dto.ResponsesStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			logger.LogError(c, "failed to unmarshal stream response: "+err.Error())
			sr.Error(err)
			return
		}
		streamCtx.observe(streamResponse)
		if err := sendResponsesStreamData(c, streamResponse, ensureResponsesTerminalOutputField(streamResponse, data)); err != nil {
			sr.Stop(err)
			return
		}
		switch streamResponse.Type {
		case "error":
			failureErr := fmt.Errorf("upstream responses stream failed")
			if streamResponse.Message != "" {
				failureErr = fmt.Errorf("upstream responses stream failed: %s", streamResponse.Message)
			}
			upstreamErr := &types.OpenAIError{
				Code:    streamResponse.Code,
				Message: streamResponse.Message,
				Param:   streamResponse.Param,
			}
			if isResponsesChannelFailure(upstreamErr) {
				sr.UpstreamFailed(failureErr)
			} else {
				sr.TerminalClientError(failureErr)
			}
		case "response.completed", "response.failed", "response.incomplete":
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
					if rt := streamResponse.Response.Usage.ResolveReasoningTokens(); rt != 0 {
						usage.CompletionTokenDetails.ReasoningTokens = rt
					}
					if streamResponse.Response.Usage.InputTokensDetails != nil {
						usage.PromptTokensDetails.CachedTokens = streamResponse.Response.Usage.InputTokensDetails.CachedTokens
						usage.PromptTokensDetails.CacheWriteTokens = streamResponse.Response.Usage.InputTokensDetails.CacheWriteTokens
					}
				}
				if streamResponse.Type == "response.completed" && streamResponse.Response.HasImageGenerationCall() {
					c.Set("image_generation_call", true)
					c.Set("image_generation_call_quality", streamResponse.Response.GetQuality())
					c.Set("image_generation_call_size", streamResponse.Response.GetSize())
				}
			}
			if streamResponse.Type == "response.failed" {
				failureErr := fmt.Errorf("upstream responses stream failed")
				var upstreamErr *types.OpenAIError
				if streamResponse.Response != nil {
					upstreamErr = streamResponse.Response.GetOpenAIError()
					if upstreamErr != nil && upstreamErr.Message != "" {
						failureErr = fmt.Errorf("upstream responses stream failed: %s", upstreamErr.Message)
					}
				}
				if isResponsesChannelFailure(upstreamErr) {
					sr.UpstreamFailed(failureErr)
				} else {
					sr.TerminalClientError(failureErr)
				}
			} else {
				sr.Done()
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

	// Synthesize a terminal event if upstream never emitted one. This prevents
	// the Codex CLI (and similar clients) from raising
	// "stream disconnected before completion: stream closed before response.completed"
	// and entering a retry loop. The synthesizer decides between
	// response.completed (graceful EOF with partial output) and
	// response.failed (timeout / scanner error / no output) based on
	// info.StreamStatus.
	if streamCtx.shouldSynthesize(c, info) {
		synthUsage, err := streamCtx.emitTerminal(c, info)
		if err != nil {
			if info != nil && info.StreamStatus != nil {
				info.StreamStatus.SetEndReasonWithSource(relaycommon.StreamEndReasonHandlerStop, err, "synthetic_terminal_write")
			}
		} else {
			if synthUsage != nil {
				usage = synthUsage
			}
			logger.LogInfo(c, fmt.Sprintf("synthesized responses terminal event (status=%s)", streamStatusSummary(info)))
		}
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

func isResponsesChannelFailure(upstreamErr *types.OpenAIError) bool {
	if upstreamErr == nil {
		return true
	}
	code := ""
	if value, ok := upstreamErr.Code.(string); ok {
		code = strings.ToLower(strings.TrimSpace(value))
	}
	switch code {
	case "server_error", "rate_limit_exceeded", "invalid_api_key", "authentication_error",
		"permission_denied", "service_unavailable", "overloaded_error":
		return true
	}

	switch code {
	case "invalid_prompt", "bio_policy", "invalid_image", "invalid_image_format", "invalid_base64_image",
		"invalid_image_url", "image_too_large", "image_too_small", "image_parse_error",
		"image_content_policy_violation", "invalid_image_mode", "image_file_too_large",
		"unsupported_image_media_type", "empty_image_file", "failed_to_download_image",
		"image_file_not_found", "context_length_exceeded", "content_policy_violation",
		"invalid_request_error", "bad_request", "validation_error", "unsupported_value":
		return false
	}

	switch strings.ToLower(strings.TrimSpace(upstreamErr.Type)) {
	case "invalid_request_error", "bad_request", "validation_error":
		return false
	default:
		return true
	}
}

func streamStatusSummary(info *relaycommon.RelayInfo) string {
	if info == nil || info.StreamStatus == nil {
		return "unknown"
	}
	return info.StreamStatus.Summary()
}
