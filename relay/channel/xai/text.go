package xai

import (
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
		// Keep provider usage intact for the client stream; billing uses the
		// separately accumulated `usage` (see xAIStreamHandler).
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

// mergeXAIStreamUsage copies stream chunk usage into the accumulated billing usage.
// xAI may place cached tokens on prompt_tokens_details, input_tokens_details, or
// top-level prompt_cache_hit_tokens; previously only prompt/total were kept (#6144).
func mergeXAIStreamUsage(dst *dto.Usage, src *dto.Usage) {
	if dst == nil || src == nil {
		return
	}
	if src.PromptTokens > 0 {
		dst.PromptTokens = src.PromptTokens
	}
	if src.TotalTokens > 0 {
		dst.TotalTokens = src.TotalTokens
	}
	if src.CompletionTokens > 0 {
		dst.CompletionTokens = src.CompletionTokens
	} else if dst.TotalTokens > 0 && dst.PromptTokens > 0 {
		dst.CompletionTokens = dst.TotalTokens - dst.PromptTokens
	}
	if src.InputTokens > 0 {
		dst.InputTokens = src.InputTokens
	}
	if src.OutputTokens > 0 {
		dst.OutputTokens = src.OutputTokens
	}
	if src.PromptCacheHitTokens > 0 {
		dst.PromptCacheHitTokens = src.PromptCacheHitTokens
	}

	// Prefer standard prompt_tokens_details.cached_tokens.
	if src.PromptTokensDetails.CachedTokens > 0 {
		dst.PromptTokensDetails.CachedTokens = src.PromptTokensDetails.CachedTokens
	}
	if src.PromptTokensDetails.CachedCreationTokens > 0 {
		dst.PromptTokensDetails.CachedCreationTokens = src.PromptTokensDetails.CachedCreationTokens
	}
	if src.PromptTokensDetails.TextTokens > 0 {
		dst.PromptTokensDetails.TextTokens = src.PromptTokensDetails.TextTokens
	}
	if src.PromptTokensDetails.AudioTokens > 0 {
		dst.PromptTokensDetails.AudioTokens = src.PromptTokensDetails.AudioTokens
	}
	if src.PromptTokensDetails.ImageTokens > 0 {
		dst.PromptTokensDetails.ImageTokens = src.PromptTokensDetails.ImageTokens
	}

	// Fallbacks used by some OpenAI-compatible providers.
	if dst.PromptTokensDetails.CachedTokens == 0 && src.InputTokensDetails != nil && src.InputTokensDetails.CachedTokens > 0 {
		dst.PromptTokensDetails.CachedTokens = src.InputTokensDetails.CachedTokens
	}
	if dst.PromptTokensDetails.CachedTokens == 0 && src.PromptCacheHitTokens > 0 {
		dst.PromptTokensDetails.CachedTokens = src.PromptCacheHitTokens
	}

	if src.CompletionTokenDetails.ReasoningTokens > 0 {
		dst.CompletionTokenDetails.ReasoningTokens = src.CompletionTokenDetails.ReasoningTokens
	}
	if src.CompletionTokenDetails.TextTokens > 0 {
		dst.CompletionTokenDetails.TextTokens = src.CompletionTokenDetails.TextTokens
	}
	if src.CompletionTokenDetails.AudioTokens > 0 {
		dst.CompletionTokenDetails.AudioTokens = src.CompletionTokenDetails.AudioTokens
	}
}

func xAIStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	usage := &dto.Usage{}
	var responseTextBuilder strings.Builder
	var toolCount int
	var containStreamUsage bool

	helper.SetEventStreamHeaders(c)

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		var xAIResp *dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &xAIResp); err != nil {
			common.SysLog("error unmarshalling stream response: " + err.Error())
			sr.Error(err)
			return
		}

		// Preserve full usage for billing — not only prompt/total (#6144).
		if xAIResp.Usage != nil {
			containStreamUsage = true
			mergeXAIStreamUsage(usage, xAIResp.Usage)
		}

		openaiResponse := streamResponseXAI2OpenAI(xAIResp, usage)
		_ = openai.ProcessStreamResponse(*openaiResponse, &responseTextBuilder, &toolCount)
		if err := helper.ObjectData(c, openaiResponse); err != nil {
			common.SysLog(err.Error())
			sr.Error(err)
		}
	})

	if !containStreamUsage {
		usage = service.ResponseText2Usage(c, responseTextBuilder.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		usage.CompletionTokens += toolCount * 7
	}

	// Align with OpenAI stream path: recover any remaining cache fields.
	openai.ApplyUsagePostProcessing(info, usage, nil)

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
		// Normalize cache fields for quota settlement.
		if xaiResponse.Usage.PromptTokensDetails.CachedTokens == 0 {
			if xaiResponse.Usage.InputTokensDetails != nil && xaiResponse.Usage.InputTokensDetails.CachedTokens > 0 {
				xaiResponse.Usage.PromptTokensDetails.CachedTokens = xaiResponse.Usage.InputTokensDetails.CachedTokens
			} else if xaiResponse.Usage.PromptCacheHitTokens > 0 {
				xaiResponse.Usage.PromptTokensDetails.CachedTokens = xaiResponse.Usage.PromptCacheHitTokens
			}
		}
	}

	// new body
	encodeJson, err := common.Marshal(xaiResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}

	service.IOCopyBytesGracefully(c, resp, encodeJson)

	if xaiResponse.Usage != nil {
		openai.ApplyUsagePostProcessing(info, xaiResponse.Usage, responseBody)
	}

	return xaiResponse.Usage, nil
}
