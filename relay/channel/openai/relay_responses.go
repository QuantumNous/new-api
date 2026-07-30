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
	if c.GetBool("playground_managed_search") {
		c.Set("playground_search_response", &responsesResponse)
		c.Set("playground_search_response_body", responseBody)
		c.Set("playground_search_response_content_type", resp.Header.Get("Content-Type"))
	}

	// Managed Playground Search persists and validates the buffered response in
	// its controller before exposing it to the browser.
	if !c.GetBool("playground_managed_search") {
		service.IOCopyBytesGracefully(c, resp, responseBody)
	}

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
	if c.GetBool("playground_managed_search") {
		webCalls, xCalls := 0, 0
		if responsesResponse.Usage != nil && responsesResponse.Usage.ServerSideToolUsage != nil {
			webCalls = responsesResponse.Usage.ServerSideToolUsage.WebSearchCalls
			xCalls = responsesResponse.Usage.ServerSideToolUsage.XSearchCalls
		} else {
			for _, output := range responsesResponse.Output {
				switch output.Type {
				case dto.BuildInCallWebSearchCall:
					webCalls++
				case dto.BuildInCallXSearchCall:
					xCalls++
				case "custom_tool_call":
					if strings.HasPrefix(output.Name, "x_") {
						xCalls++
					}
				}
			}
		}
		if tool := info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolXAIWebSearch]; tool != nil {
			tool.CallCount = webCalls
		}
		if tool := info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolXAIXSearch]; tool != nil {
			tool.CallCount = xCalls
		}
		return &usage, nil
	}
	for _, output := range responsesResponse.Output {
		if !relaycommon.IsBillableResponsesOutput(&output) {
			continue
		}
		switch output.Type {
		case dto.BuildInCallWebSearchCall:
			info.CountBillableToolCall(dto.BuildInCallWebSearchCall, "")
		case dto.BuildInCallFileSearchCall:
			info.CountBillableToolCall(dto.BuildInCallFileSearchCall, "")
		case dto.BuildInCallFunctionCall:
			info.CountBillableToolCall(dto.BuildInCallFunctionCall, output.Name)
		}
	}

	imageCounter := &relaycommon.ImageGenerationCallCounter{}
	if !relaycommon.IsNonBillableResponsesStatus(responsesResponse.Status) {
		for index := range responsesResponse.Output {
			output := &responsesResponse.Output[index]
			before := imageCounter.Count()
			imageCounter.Observe(output, &index)
			if imageCounter.Count() > before {
				c.Set("image_generation_call_quality", output.Quality)
				c.Set("image_generation_call_size", output.Size)
			}
		}
	}
	imageCounter.Commit(info)
	if imageCounter.Count() > 0 {
		c.Set("image_generation_call", true)
		c.Set("image_generation_call_count", min(imageCounter.Count(), dto.MaxImageN))
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
	imageCounter := &relaycommon.ImageGenerationCallCounter{}
	imageCommitted := false
	imageQuality := ""
	imageSize := ""
	seenToolItems := make(map[string]struct{})

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {

		// 检查当前数据是否包含 completed 状态和 usage 信息
		var streamResponse dto.ResponsesStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			logger.LogError(c, "failed to unmarshal stream response: "+err.Error())
			sr.Error(err)
			return
		}
		sendResponsesStreamData(c, streamResponse, data)
		switch streamResponse.Type {
		case "response.completed", "response.done":
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
						usage.PromptTokensDetails.CacheWriteTokens = streamResponse.Response.Usage.InputTokensDetails.CacheWriteTokens
					}
				}
				if !imageCommitted {
					if relaycommon.IsNonBillableResponsesStatus(streamResponse.Response.Status) {
						imageCounter.Reset()
					} else {
						for index := range streamResponse.Response.Output {
							output := &streamResponse.Response.Output[index]
							before := imageCounter.Count()
							imageCounter.Observe(output, &index)
							if imageCounter.Count() > before {
								imageQuality = output.Quality
								imageSize = output.Size
							}
						}
					}
					imageCounter.Commit(info)
					imageCommitted = true
				}
			} else if !imageCommitted {
				imageCounter.Commit(info)
				imageCommitted = true
			}
		case "response.failed", "response.incomplete", "response.cancelled", "response.canceled":
			if !imageCommitted {
				imageCounter.Reset()
				imageCounter.Commit(info)
				imageCommitted = true
			}
		case "response.output_text.delta":
			// 处理输出文本
			responseTextBuilder.WriteString(streamResponse.Delta)
		case dto.ResponsesOutputTypeItemDone:
			if relaycommon.IsBillableResponsesOutput(streamResponse.Item) {
				identity := responsesStreamToolIdentity(&streamResponse)
				if identity != "" {
					if _, exists := seenToolItems[identity]; exists {
						break
					}
					seenToolItems[identity] = struct{}{}
				}
				switch streamResponse.Item.Type {
				case dto.BuildInCallWebSearchCall:
					info.CountBillableToolCall(dto.BuildInCallWebSearchCall, "")
				case dto.BuildInCallFileSearchCall:
					info.CountBillableToolCall(dto.BuildInCallFileSearchCall, "")
				case dto.BuildInCallFunctionCall:
					info.CountBillableToolCall(dto.BuildInCallFunctionCall, streamResponse.Item.Name)
				case dto.ResponsesOutputTypeImageGenerationCall:
					if !imageCommitted {
						before := imageCounter.Count()
						imageCounter.Observe(streamResponse.Item, streamResponse.OutputIndex)
						if imageCounter.Count() > before {
							imageQuality = streamResponse.Item.Quality
							imageSize = streamResponse.Item.Size
						}
					}
				}
			}
		}
	})
	if imageCommitted && imageCounter.Count() > 0 {
		c.Set("image_generation_call", true)
		c.Set("image_generation_call_count", min(imageCounter.Count(), dto.MaxImageN))
		c.Set("image_generation_call_quality", imageQuality)
		c.Set("image_generation_call_size", imageSize)
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

func responsesStreamToolIdentity(response *dto.ResponsesStreamResponse) string {
	if response == nil || response.Item == nil {
		return ""
	}
	if response.Item.ID != "" {
		return "id:" + response.Item.ID
	}
	if response.Item.CallId != "" {
		return "call:" + response.Item.CallId
	}
	if response.OutputIndex != nil {
		return fmt.Sprintf("index:%d", *response.OutputIndex)
	}
	return ""
}
