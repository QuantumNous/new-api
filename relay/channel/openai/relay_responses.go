package openai

import (
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	relaycommon "one-api/relay/common"
	"one-api/relay/helper"
	"one-api/service"
	"strings"

	"github.com/gin-gonic/gin"
)

func OaiResponsesHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.OpenAIErrorWithStatusCode, *dto.Usage) {
	defer common.CloseResponseBodyGracefully(resp)

	// read response body
	var responsesResponse dto.OpenAIResponsesResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return service.OpenAIErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError), nil
	}
	err = common.UnmarshalJson(responseBody, &responsesResponse)
	if err != nil {
		return service.OpenAIErrorWrapper(err, "unmarshal_response_body_failed", http.StatusInternalServerError), nil
	}
	if responsesResponse.Error != nil {
		return &dto.OpenAIErrorWithStatusCode{
			Error: dto.OpenAIError{
				Message: responsesResponse.Error.Message,
				Type:    "openai_error",
				Code:    responsesResponse.Error.Code,
			},
			StatusCode: resp.StatusCode,
		}, nil
	}

	// 写入新的 response body
	common.IOCopyBytesGracefully(c, resp, responseBody)

	// compute usage
	usage := dto.Usage{}
	usage.PromptTokens = responsesResponse.Usage.InputTokens
	usage.CompletionTokens = responsesResponse.Usage.OutputTokens
	usage.TotalTokens = responsesResponse.Usage.TotalTokens
	// 解析 Tools 用量
	for _, tool := range responsesResponse.Tools {
		info.ResponsesUsageInfo.BuiltInTools[tool.Type].CallCount++
	}
	return nil, &usage
}

func OaiResponsesStreamHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.OpenAIErrorWithStatusCode, *dto.Usage) {
	if resp == nil || resp.Body == nil {
		common.LogError(c, "invalid response or response body")
		return service.OpenAIErrorWrapper(fmt.Errorf("invalid response"), "invalid_response", http.StatusInternalServerError), nil
	}

	var usage = &dto.Usage{}
	var responseTextBuilder strings.Builder

	helper.StreamScannerHandler(c, resp, info, func(data string) bool {

		// 检查当前数据是否包含 completed 状态和 usage 信息
		var streamResponse dto.ResponsesStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err == nil {
			sendResponsesStreamData(c, streamResponse, data)
			switch streamResponse.Type {
			case "response.completed":
				usage.PromptTokens = streamResponse.Response.Usage.InputTokens
				usage.CompletionTokens = streamResponse.Response.Usage.OutputTokens
				usage.TotalTokens = streamResponse.Response.Usage.TotalTokens
			case "response.output_text.delta":
				// 处理输出文本
				responseTextBuilder.WriteString(streamResponse.Delta)
			case dto.ResponsesOutputTypeItemDone:
				// 函数调用处理
				if streamResponse.Item != nil {
					switch streamResponse.Item.Type {
					case dto.BuildInCallWebSearchCall:
						info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolWebSearchPreview].CallCount++
					}
				}
			}
		}
		return true
	})

	if usage.CompletionTokens == 0 {
		// 计算输出文本的 token 数量
		tempStr := responseTextBuilder.String()
		if len(tempStr) > 0 {
			// 非正常结束，使用输出文本的 token 数量
			completionTokens := service.CountTextToken(tempStr, info.UpstreamModelName)
			usage.CompletionTokens = completionTokens
		}
	}

	return nil, usage
}
