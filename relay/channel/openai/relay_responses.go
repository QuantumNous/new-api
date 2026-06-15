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

func shouldTrustResponsesUsage(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return false
	}
	return relaycommon.ShouldTrustUpstreamUsage(info.ChannelOtherSettings)
}

func responsesTrustedUsage(info *relaycommon.RelayInfo, responseUsage *dto.Usage) (*dto.Usage, bool) {
	if !shouldTrustResponsesUsage(info) {
		return nil, false
	}
	usage := responsesUsageToUsage(responseUsage)
	if !service.ValidUsage(usage) {
		return nil, false
	}
	return usage, true
}

func responsesUsageToUsage(responseUsage *dto.Usage) *dto.Usage {
	usage := &dto.Usage{}
	if responseUsage == nil {
		return usage
	}
	usage.PromptTokens = responseUsage.InputTokens
	usage.CompletionTokens = responseUsage.OutputTokens
	usage.TotalTokens = responseUsage.TotalTokens
	usage.InputTokens = responseUsage.InputTokens
	usage.OutputTokens = responseUsage.OutputTokens
	if responseUsage.InputTokensDetails != nil {
		usage.PromptTokensDetails.CachedTokens = responseUsage.InputTokensDetails.CachedTokens
		usage.PromptTokensDetails.ImageTokens = responseUsage.InputTokensDetails.ImageTokens
		usage.PromptTokensDetails.AudioTokens = responseUsage.InputTokensDetails.AudioTokens
	}
	if responseUsage.CompletionTokenDetails.ReasoningTokens != 0 {
		usage.CompletionTokenDetails.ReasoningTokens = responseUsage.CompletionTokenDetails.ReasoningTokens
	}
	if usage.TotalTokens == 0 {
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}
	return usage
}

func responsesLocalUsage(c *gin.Context, info *relaycommon.RelayInfo, response *dto.OpenAIResponsesResponse) *dto.Usage {
	text := service.ExtractOutputTextFromResponses(response)
	if info == nil {
		return service.ResponseText2Usage(c, text, "", 0)
	}
	return service.ResponseText2Usage(c, text, info.UpstreamModelName, info.GetEstimatePromptTokens())
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

	if responsesResponse.HasImageGenerationCall() {
		c.Set("image_generation_call", true)
		c.Set("image_generation_call_quality", responsesResponse.GetQuality())
		c.Set("image_generation_call_size", responsesResponse.GetSize())
	}

	// 写入新的 response body
	service.IOCopyBytesGracefully(c, resp, responseBody)

	// compute usage
	var usage *dto.Usage
	if trustedUsage, ok := responsesTrustedUsage(info, responsesResponse.Usage); ok {
		usage = trustedUsage
	} else {
		usage = responsesLocalUsage(c, info, &responsesResponse)
	}
	if info == nil || info.ResponsesUsageInfo == nil || info.ResponsesUsageInfo.BuiltInTools == nil {
		return usage, nil
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
		case "response.completed":
			if streamResponse.Response != nil {
				if trustedUsage, ok := responsesTrustedUsage(info, streamResponse.Response.Usage); ok {
					usage = trustedUsage
				}
				if streamResponse.Response.HasImageGenerationCall() {
					c.Set("image_generation_call", true)
					c.Set("image_generation_call_quality", streamResponse.Response.GetQuality())
					c.Set("image_generation_call_size", streamResponse.Response.GetSize())
				}
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

	if usage.CompletionTokens == 0 {
		if info == nil {
			usage = service.ResponseText2Usage(c, responseTextBuilder.String(), "", 0)
		} else {
			usage = service.ResponseText2Usage(c, responseTextBuilder.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		}
	}

	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens

	return usage, nil
}
