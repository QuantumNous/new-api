package cloudflare

import (
	"bufio"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
)

func convertCf2CompletionsRequest(textRequest dto.GeneralOpenAIRequest) *CfRequest {
	p, _ := textRequest.Prompt.(string)
	return &CfRequest{
		Prompt:      p,
		MaxTokens:   textRequest.GetMaxTokens(),
		Stream:      lo.FromPtrOr(textRequest.Stream, false),
		Temperature: textRequest.Temperature,
	}
}

func cfStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*types.NewAPIError, *dto.Usage) {
	scanner := helper.NewStreamScanner(resp.Body)
	scanner.Split(bufio.ScanLines)

	helper.SetEventStreamHeaders(c)
	id := helper.GetResponseID(c)
	var responseText strings.Builder
	var usage *dto.Usage
	completed := false
	isFirst := true

	for scanner.Scan() {
		data, ok := strings.CutPrefix(scanner.Text(), "data:")
		if !ok {
			continue
		}
		data = strings.TrimSpace(data)

		if data == "[DONE]" {
			completed = true
			break
		}

		var response dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &response); err != nil {
			logger.LogError(c, common.LogText("error_unmarshalling_stream_response: %s", err.Error()))
			continue
		}
		if isFirst {
			isFirst = false
			info.FirstResponseTime = time.Now()
		}
		for _, choice := range response.Choices {
			content := choice.Delta.GetContentString()
			responseText.WriteString(content)
			if usage != nil && (content != "" || choice.Delta.GetReasoningContent() != "" || len(choice.Delta.ToolCalls) > 0) {
				usage = nil
			}
		}
		// Cloudflare sends usage deltas before the final summary. Empty frames do not replace a summary.
		if len(response.Choices) == 0 || response.IsFinished() {
			if summary := cloudflareChatUsage(response.Usage); summary != nil {
				usage = summary
			}
		}
		if len(response.Choices) == 0 && response.Usage != nil {
			continue
		}
		response.Usage = nil
		response.Id = id
		response.Model = info.UpstreamModelName
		if err := helper.ObjectData(c, response); err != nil {
			logger.LogError(c, common.LogText("error_rendering_stream_response: %s", err.Error()))
		}
	}

	if err := scanner.Err(); err != nil {
		logger.LogError(c, common.LogText("error_scanning_stream_response: %s", err.Error()))
	}
	if !completed || usage == nil {
		usage = service.ResponseText2Usage(c, responseText.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
	}
	if info.ShouldIncludeUsage {
		response := helper.GenerateFinalUsageResponse(id, info.StartTime.Unix(), info.UpstreamModelName, *usage)
		err := helper.ObjectData(c, response)
		if err != nil {
			logger.LogError(c, common.LogText("error_rendering_final_usage_response: %s", err.Error()))
		}
	}
	helper.Done(c)

	service.CloseResponseBodyGracefully(resp)

	return nil, usage
}

func cfHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*types.NewAPIError, *dto.Usage) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}
	service.CloseResponseBodyGracefully(resp)
	var response dto.TextResponse
	if err := common.Unmarshal(responseBody, &response); err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}
	response.Model = info.UpstreamModelName
	usage := cloudflareChatUsage(&response.Usage)
	if usage == nil {
		var responseText strings.Builder
		for _, choice := range response.Choices {
			responseText.WriteString(choice.Message.StringContent())
		}
		usage = service.ResponseText2Usage(c, responseText.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
	}
	response.Usage = *usage
	response.Id = helper.GetResponseID(c)
	jsonResponse, err := common.Marshal(response)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, _ = c.Writer.Write(jsonResponse)
	return nil, usage
}

func cloudflareChatUsage(upstream *dto.Usage) *dto.Usage {
	if upstream == nil || upstream.PromptTokens <= 0 || upstream.TotalTokens < upstream.PromptTokens ||
		upstream.CompletionTokens != upstream.TotalTokens-upstream.PromptTokens {
		return nil
	}
	cached := upstream.PromptTokensDetails.CachedTokens
	if cached < 0 || cached > upstream.PromptTokens {
		return nil
	}
	return &dto.Usage{
		PromptTokens:        upstream.PromptTokens,
		CompletionTokens:    upstream.CompletionTokens,
		TotalTokens:         upstream.TotalTokens,
		PromptTokensDetails: dto.InputTokenDetails{CachedTokens: cached},
	}
}

func cfSTTHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*types.NewAPIError, *dto.Usage) {
	var cfResp CfAudioResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}
	service.CloseResponseBodyGracefully(resp)
	err = json.Unmarshal(responseBody, &cfResp)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}

	audioResp := &dto.AudioResponse{
		Text: cfResp.Result.Text,
	}

	jsonResponse, err := json.Marshal(audioResp)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, _ = c.Writer.Write(jsonResponse)

	usage := service.ResponseText2Usage(c, cfResp.Result.Text, info.UpstreamModelName, info.GetEstimatePromptTokens())
	return nil, usage
}
