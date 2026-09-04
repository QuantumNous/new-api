package openai

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

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

	// 写入新的 response body
	service.IOCopyBytesGracefully(c, resp, responseBody)

	// compute usage
	usage := relayconvert.NormalizeResponsesUsage(responsesResponse.Usage)
	// Count actual tool invocations from Output (not tool declarations).
	for _, output := range responsesResponse.Output {
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
		for i := range responsesResponse.Output {
			idx := i
			imageCounter.Observe(&responsesResponse.Output[i], &idx)
		}
	}
	imageCounter.Commit(info)

	return usage, nil
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
					incomingUsage := relayconvert.NormalizeResponsesUsage(streamResponse.Response.Usage)
					usage = dto.MergeUsageNonZero(usage, incomingUsage)
				}
				if !imageCommitted {
					if relaycommon.IsNonBillableResponsesStatus(streamResponse.Response.Status) {
						imageCounter.Reset()
						imageCounter.Commit(info)
						imageCommitted = true
					} else {
						for i := range streamResponse.Response.Output {
							idx := i
							imageCounter.Observe(&streamResponse.Response.Output[i], &idx)
						}
						imageCounter.Commit(info)
						imageCommitted = true
					}
				}
			} else if !imageCommitted {
				imageCounter.Commit(info)
				imageCommitted = true
			}
			sr.Done()
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
			if streamResponse.Item != nil {
				switch streamResponse.Item.Type {
				case dto.BuildInCallWebSearchCall:
					info.CountBillableToolCall(dto.BuildInCallWebSearchCall, "")
				case dto.BuildInCallFileSearchCall:
					info.CountBillableToolCall(dto.BuildInCallFileSearchCall, "")
				case dto.BuildInCallFunctionCall:
					info.CountBillableToolCall(dto.BuildInCallFunctionCall, streamResponse.Item.Name)
				case dto.ResponsesOutputTypeImageGenerationCall:
					if !imageCommitted {
						imageCounter.Observe(streamResponse.Item, streamResponse.OutputIndex)
					}
				}
			}
		}
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

	if usage.PromptTokens == 0 && usage.CompletionTokens != 0 {
		usage.PromptTokens = info.GetEstimatePromptTokens()
	}

	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	if usage.BillingUsage != nil {
		usage.BillingUsage = dto.CloneBillingUsageWithEstimatedCompletion(usage.BillingUsage, usage.CompletionTokens)
	}

	return usage, nil
}
