package relay

import (
	"bufio"
	"bytes"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// responsesViaChatCompletions converts a Responses API request to a Chat
// Completions request, sends it upstream via /v1/chat/completions, and
// converts the response back to Responses format. This is the inverse of
// chatCompletionsViaResponses and is used for models that do not support the
// Responses API natively (e.g. image generation models on upstream proxies).
func responsesViaChatCompletions(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.Adaptor, request *dto.OpenAIResponsesRequest) (*dto.Usage, *types.NewAPIError) {
	chatReq, err := service.ResponsesRequestToChatCompletionsRequest(request)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeConvertRequestFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	info.AppendRequestConversion(types.RelayFormatOpenAI)

	savedRelayMode := info.RelayMode
	savedRequestURLPath := info.RequestURLPath
	defer func() {
		info.RelayMode = savedRelayMode
		info.RequestURLPath = savedRequestURLPath
	}()

	info.RelayMode = relayconstant.RelayModeChatCompletions
	info.RequestURLPath = "/v1/chat/completions"

	convertedRequest, err := adaptor.ConvertOpenAIRequest(c, info, chatReq)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)

	jsonData, err := common.Marshal(convertedRequest)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	jsonData, err = relaycommon.RemoveDisabledFields(jsonData, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	if len(info.ParamOverride) > 0 {
		jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
		if err != nil {
			return nil, newAPIErrorFromParamOverride(err)
		}
	}

	var requestBody io.Reader = bytes.NewBuffer(jsonData)

	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	if resp == nil {
		return nil, types.NewOpenAIError(nil, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	httpResp := resp.(*http.Response)
	isStream := strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
	if httpResp.StatusCode != http.StatusOK {
		newApiErr := service.RelayErrorHandler(c.Request.Context(), httpResp, false)
		service.ResetStatusCode(newApiErr, statusCodeMappingStr)
		return nil, newApiErr
	}

	// The upstream responded with a chat completions response. Convert it
	// back to the Responses API format before returning to the caller.
	var usage *dto.Usage
	var newApiErr *types.NewAPIError
	if isStream {
		usage, newApiErr = oaiChatStreamToResponsesHandler(c, info, httpResp)
	} else {
		usage, newApiErr = oaiChatToResponsesHandler(c, info, httpResp)
	}
	if newApiErr != nil {
		service.ResetStatusCode(newApiErr, statusCodeMappingStr)
		return nil, newApiErr
	}
	return usage, nil
}

// oaiChatToResponsesHandler reads a non-streaming Chat Completions response
// and re-emits it as a Responses API response.
func oaiChatToResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(nil, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	defer service.CloseResponseBodyGracefully(resp)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	var chatResp dto.OpenAITextResponse
	if err := common.Unmarshal(body, &chatResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	responsesResp, err := service.ChatCompletionsResponseToResponsesResponse(&chatResp, info.UpstreamModelName)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	usage := &dto.Usage{
		PromptTokens:     chatResp.Usage.PromptTokens,
		CompletionTokens: chatResp.Usage.CompletionTokens,
		TotalTokens:      chatResp.Usage.TotalTokens,
	}
	if usage.TotalTokens == 0 {
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}
	usage.PromptTokensDetails = chatResp.Usage.PromptTokensDetails
	usage.CompletionTokenDetails = chatResp.Usage.CompletionTokenDetails

	responseBody, err := common.Marshal(responsesResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}

	// Write the Responses API JSON back to the client using the original
	// HTTP response wrapper so that content-type and status are set correctly.
	service.IOCopyBytesGracefully(c, resp, responseBody)
	return usage, nil
}

// isImageGenerationModelForResponses checks if a model is an image generation
// model that should be routed through chat completions when called via the
// Responses API. Uses the upstream model name (after mapping) to catch mapped
// names like gpt-image-1.5-all.
func isImageGenerationModelForResponses(modelName string) bool {
	return common.IsImageGenerationModel(modelName)
}

// oaiChatStreamToResponsesHandler reads a streaming (SSE) Chat Completions
// response, accumulates all chunks into a single message, then emits it as a
// non-streaming Responses API JSON response. This handles upstreams that always
// return SSE even when stream was not requested (common with image generation
// proxies).
func oaiChatStreamToResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(nil, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	defer service.CloseResponseBodyGracefully(resp)

	var (
		contentBuilder strings.Builder
		model          string
		usage          = &dto.Usage{}
		finishReason   = "stop"
	)

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 1024*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" || data == "" {
			continue
		}

		var chunk dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &chunk); err != nil {
			continue
		}

		if chunk.Model != "" {
			model = chunk.Model
		}

		if chunk.Usage != nil {
			usage = chunk.Usage
		}

		for _, choice := range chunk.Choices {
			if choice.Delta.Content != nil {
				contentBuilder.WriteString(*choice.Delta.Content)
			}
			if choice.FinishReason != nil {
				finishReason = *choice.FinishReason
			}
		}
	}

	if model == "" {
		model = info.UpstreamModelName
	}

	// Build a synthetic OpenAITextResponse from accumulated chunks
	chatResp := &dto.OpenAITextResponse{
		Id:      "chatcmpl-" + common.GetUUID(),
		Object:  "chat.completion",
		Model:   model,
		Choices: []dto.OpenAITextResponseChoice{{
			Index:        0,
			Message:      dto.Message{Role: "assistant", Content: contentBuilder.String()},
			FinishReason: finishReason,
		}},
		Usage: *usage,
	}

	if usage.TotalTokens == 0 {
		text := contentBuilder.String()
		usage = service.ResponseText2Usage(c, text, info.UpstreamModelName, info.GetEstimatePromptTokens())
		chatResp.Usage = *usage
	}

	responsesResp, err := service.ChatCompletionsResponseToResponsesResponse(chatResp, info.UpstreamModelName)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	responseBody, err := common.Marshal(responsesResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)
	return usage, nil
}

// shouldResponsesUseChatCompletions returns true when a /v1/responses request
// should be internally converted to /v1/chat/completions. Currently this
// applies to image generation models whose upstream providers do not support
// the Responses API for image generation.
func shouldResponsesUseChatCompletions(info *relaycommon.RelayInfo) bool {
	modelToCheck := info.UpstreamModelName
	if modelToCheck == "" {
		modelToCheck = info.OriginModelName
	}
	return isImageGenerationModelForResponses(modelToCheck)
}
