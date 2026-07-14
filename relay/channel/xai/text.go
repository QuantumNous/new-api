package xai

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func streamResponseXAI2OpenAI(xAIResp *dto.ChatCompletionsStreamResponse, usage *dto.Usage) *dto.ChatCompletionsStreamResponse {
	if xAIResp == nil {
		return nil
	}
	if xAIResp.Usage != nil {
		xAIResp.Usage.CompletionTokens = usage.CompletionTokens
	}
	openAIResp := &dto.ChatCompletionsStreamResponse{
		Id:      xAIResp.Id,
		Object:  xAIResp.Object,
		Created: xAIResp.Created,
		Model:   xAIResp.Model,
		Choices: xAIResp.Choices,
		Usage:   xAIResp.Usage,
	}

	return openAIResp
}

func xAIStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	usage := &dto.Usage{}
	var responseTextBuilder strings.Builder
	var toolCount int
	var containStreamUsage bool
	var streamErr *types.NewAPIError

	helper.SetEventStreamHeaders(c)

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		var errorResponse dto.OpenAITextResponse
		if err := common.UnmarshalJsonStr(data, &errorResponse); err == nil {
			if oaiError := errorResponse.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
				streamErr = types.WithOpenAIError(*oaiError, http.StatusBadGateway)
				sr.Stop(streamErr)
				return
			}
		}
		var xAIResp *dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &xAIResp); err != nil {
			common.SysLog("error unmarshalling stream response: " + err.Error())
			sr.Error(err)
			return
		}
		if xAIResp == nil {
			sr.Error(fmt.Errorf("empty xAI stream response"))
			return
		}

		// 把 xAI 的usage转换为 OpenAI 的usage
		if xAIResp.Usage != nil {
			containStreamUsage = true
			*usage = *xAIResp.Usage
			if usage.CompletionTokens == 0 {
				usage.CompletionTokens = usage.TotalTokens - usage.PromptTokens
			}
		}

		openaiResponse := streamResponseXAI2OpenAI(xAIResp, usage)
		_ = openai.ProcessStreamResponse(*openaiResponse, &responseTextBuilder, &toolCount)
		if err := helper.ObjectData(c, openaiResponse); err != nil {
			common.SysLog(err.Error())
			sr.Error(err)
		}
	})
	if streamErr != nil {
		if !helper.HasWrittenUpstreamResponse(c) {
			return nil, streamErr
		}
		_ = helper.ObjectData(c, gin.H{"error": streamErr.ToOpenAIError()})
		if !containStreamUsage {
			usage = service.ResponseText2Usage(c, responseTextBuilder.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
			usage.CompletionTokens += toolCount * 7
		}
		return usage, nil
	}
	if apiErr := helper.StreamErrorBeforeResponse(c, info); apiErr != nil {
		return nil, apiErr
	}

	if !containStreamUsage {
		usage = service.ResponseText2Usage(c, responseTextBuilder.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		usage.CompletionTokens += toolCount * 7
	}

	helper.Done(c)
	service.CloseResponseBodyGracefully(resp)
	return usage, nil
}

func xAIHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	var xaiResponse ChatCompletionResponse
	err = common.Unmarshal(responseBody, &xaiResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	if xaiResponse.Usage != nil {
		xaiResponse.Usage.CompletionTokens = xaiResponse.Usage.TotalTokens - xaiResponse.Usage.PromptTokens
		xaiResponse.Usage.CompletionTokenDetails.TextTokens = xaiResponse.Usage.CompletionTokens - xaiResponse.Usage.CompletionTokenDetails.ReasoningTokens
	}

	// new body
	encodeJson, err := common.Marshal(xaiResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}

	service.IOCopyBytesGracefully(c, resp, encodeJson)

	return xaiResponse.Usage, nil
}
