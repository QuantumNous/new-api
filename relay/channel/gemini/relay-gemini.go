package gemini

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func buildUsageFromGeminiMetadata(metadata *dto.GeminiUsageMetadata, fallbackPromptTokens int) dto.Usage {
	usage := relayconvert.UsageFromGeminiMetadata(metadata, fallbackPromptTokens)
	if usage == nil {
		return dto.Usage{}
	}
	return *usage
}

func attachEstimatedGeminiBillingUsage(usage *dto.Usage) *dto.Usage {
	if usage != nil && usage.BillingUsage == nil {
		usage.BillingUsage = dto.NewEstimatedGeminiChatBillingUsage(usage)
	}
	return usage
}

// patchGeminiZeroCompletionUsage estimates completion tokens locally when upstream
// usageMetadata was billable but reported zero completion tokens even though output
// content was actually received. Typical case: the client aborts a stream before the
// final chunk that carries candidatesTokenCount, leaving prompt-only metadata; without
// this patch the output side would settle at zero quota.
func patchGeminiZeroCompletionUsage(c *gin.Context, info *relaycommon.RelayInfo, usage *dto.Usage, responseText string, imageCount int) {
	if usage == nil || usage.CompletionTokens > 0 {
		return
	}
	if responseText == "" && imageCount == 0 {
		return
	}
	estimated := service.ResponseText2Usage(c, responseText, info.UpstreamModelName, usage.PromptTokens)
	usage.CompletionTokens = estimated.CompletionTokens
	if imageCount != 0 && usage.CompletionTokens == 0 {
		usage.CompletionTokens = imageCount * 1400
	}
	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	// Overwrite the metadata-derived billing usage: effectiveBillingUsage prefers
	// BillingUsage during settlement, so keeping the prompt-only metadata there
	// would still bill zero completion tokens.
	usage.BillingUsage = dto.NewEstimatedGeminiChatBillingUsage(usage)
}

func geminiResponseUsageText(response *dto.GeminiChatResponse) string {
	if response == nil {
		return ""
	}
	var text strings.Builder
	for _, candidate := range response.Candidates {
		for _, part := range candidate.Content.Parts {
			if part.Text != "" {
				text.WriteString(part.Text)
			}
		}
	}
	return text.String()
}

func markGeminiGoogleSearchCall(c *gin.Context, response *dto.GeminiChatResponse) {
	if c == nil || response == nil {
		return
	}
	for _, candidate := range response.Candidates {
		if candidate.GroundingMetadata != nil && len(candidate.GroundingMetadata.WebSearchQueries) > 0 {
			c.Set("gemini_google_search_call", true)
			return
		}
	}
}

func buildUsageFromGeminiResponse(c *gin.Context, info *relaycommon.RelayInfo, response *dto.GeminiChatResponse) dto.Usage {
	metadata := response.GetUsageMetadata()
	if dto.HasGeminiUsageMetadataTokens(metadata) {
		usage := buildUsageFromGeminiMetadata(metadata, info.GetEstimatePromptTokens())
		patchGeminiZeroCompletionUsage(c, info, &usage, geminiResponseUsageText(response), geminiResponseInlineImageCount(response))
		return usage
	}
	usage := service.ResponseText2Usage(c, geminiResponseUsageText(response), info.UpstreamModelName, info.GetEstimatePromptTokens())
	attachEstimatedGeminiBillingUsage(usage)
	return *usage
}

func geminiResponseInlineImageCount(response *dto.GeminiChatResponse) int {
	if response == nil {
		return 0
	}
	count := 0
	for _, candidate := range response.Candidates {
		for _, part := range candidate.Content.Parts {
			if part.InlineData != nil && part.InlineData.MimeType != "" {
				count++
			}
		}
	}
	return count
}

func geminiClientFormat(info *relaycommon.RelayInfo) types.RelayFormat {
	if info == nil || info.RelayFormat == "" {
		return types.RelayFormatOpenAI
	}
	return info.RelayFormat
}

func writeGeminiNativeBody(c *gin.Context, info *relaycommon.RelayInfo, httpResp *http.Response, geminiResponse *dto.GeminiChatResponse, original []byte) *types.NewAPIError {
	client := geminiClientFormat(info)
	if client == types.RelayFormatGemini {
		service.IOCopyBytesGracefully(c, httpResp, original)
		return nil
	}
	result, err := relayconvert.ConvertResponse(c, info, client, geminiResponse)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	body, err := common.Marshal(result.Value)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	service.IOCopyBytesGracefully(c, httpResp, body)
	return nil
}

func geminiStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response, callback func(data string, geminiResponse *dto.GeminiChatResponse) bool) (*dto.Usage, *types.NewAPIError) {
	var usage = &dto.Usage{}
	var imageCount int
	var hasBillableUsageMetadata bool
	responseText := strings.Builder{}

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		var geminiResponse dto.GeminiChatResponse
		if err := common.UnmarshalJsonStr(data, &geminiResponse); err != nil {
			sr.Stop(fmt.Errorf("unmarshal: %w", err))
			return
		}

		if len(geminiResponse.Candidates) == 0 && geminiResponse.PromptFeedback != nil && geminiResponse.PromptFeedback.BlockReason != nil {
			common.SetContextKey(c, constant.ContextKeyAdminRejectReason, fmt.Sprintf("gemini_block_reason=%s", *geminiResponse.PromptFeedback.BlockReason))
		}

		markGeminiGoogleSearchCall(c, &geminiResponse)

		for _, candidate := range geminiResponse.Candidates {
			for _, part := range candidate.Content.Parts {
				if part.InlineData != nil && part.InlineData.MimeType != "" {
					imageCount++
				}
				if part.Text != "" {
					responseText.WriteString(part.Text)
				}
			}
		}

		if metadata := geminiResponse.GetUsageMetadata(); dto.HasGeminiUsageMetadataTokens(metadata) {
			mappedUsage := buildUsageFromGeminiMetadata(metadata, info.GetEstimatePromptTokens())
			*usage = mappedUsage
			hasBillableUsageMetadata = true
		}

		if !callback(data, &geminiResponse) {
			sr.Stop(fmt.Errorf("gemini callback stopped"))
		}
	})

	if !hasBillableUsageMetadata {
		if info.ReceivedResponseCount > 0 {
			usage = service.ResponseText2Usage(c, responseText.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		} else {
			usage = &dto.Usage{}
		}
		if imageCount != 0 && usage.CompletionTokens == 0 {
			usage.CompletionTokens = imageCount * 1400
			usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
			common.SetContextKey(c, constant.ContextKeyLocalCountTokens, true)
		}
		attachEstimatedGeminiBillingUsage(usage)
	} else {
		patchGeminiZeroCompletionUsage(c, info, usage, responseText.String(), imageCount)
	}

	return usage, nil
}

func GeminiChatStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	client := geminiClientFormat(info)
	id := helper.GetResponseID(c)
	createAt := common.GetTimestamp()

	if client == types.RelayFormatGemini {
		return geminiStreamHandler(c, info, resp, func(data string, _ *dto.GeminiChatResponse) bool {
			if err := helper.StringData(c, data); err != nil {
				logger.LogError(c, err.Error())
				return false
			}
			info.SendResponseCount++
			return true
		})
	}

	state, err := relayconvert.NewResponseStreamState(types.RelayFormatGemini, client, relayconvert.ResponseStreamOptions{
		ID:      id,
		Model:   info.UpstreamModelName,
		Created: createAt,
	})
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	if client == types.RelayFormatClaude && info.ClaudeConvertInfo == nil {
		info.ClaudeConvertInfo = &relaycommon.ClaudeConvertInfo{LastMessagesType: relaycommon.LastMessageTypeNone}
	}

	var streamErr *types.NewAPIError
	usage, handlerErr := geminiStreamHandler(c, info, resp, func(_ string, geminiResponse *dto.GeminiChatResponse) bool {
		results, convErr := relayconvert.ConvertStreamResponseChunk(c, info, state, geminiResponse)
		if convErr != nil {
			streamErr = types.NewOpenAIError(convErr, types.ErrorCodeBadResponse, http.StatusInternalServerError)
			return false
		}
		if writeErr := helper.WriteProjectedStreamResults(c, info, results); writeErr != nil {
			streamErr = types.NewOpenAIError(writeErr, types.ErrorCodeBadResponse, http.StatusInternalServerError)
			return false
		}
		return true
	})
	if handlerErr != nil {
		return usage, handlerErr
	}
	if streamErr != nil {
		return usage, streamErr
	}
	if usage != nil {
		state.SetUsage(usage)
	}
	finalResults, finalErr := relayconvert.FinalizeStreamResponse(c, info, state)
	if finalErr != nil {
		return usage, types.NewOpenAIError(finalErr, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	if writeErr := helper.WriteProjectedStreamResults(c, info, finalResults); writeErr != nil {
		return usage, types.NewOpenAIError(writeErr, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	if client == types.RelayFormatOpenAI {
		if info.ShouldIncludeUsage && usage != nil {
			if writeErr := helper.ObjectData(c, helper.GenerateFinalUsageResponse(id, createAt, info.UpstreamModelName, *usage)); writeErr != nil {
				common.SysLog("send final response failed: " + writeErr.Error())
			}
		}
		helper.Done(c)
	}
	return usage, nil
}

func GeminiChatHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)
	logger.LogDebug(c, "Gemini response body: %s", responseBody)
	var geminiResponse dto.GeminiChatResponse
	err = common.Unmarshal(responseBody, &geminiResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	markGeminiGoogleSearchCall(c, &geminiResponse)
	if len(geminiResponse.Candidates) == 0 {
		usage := buildUsageFromGeminiResponse(c, info, &geminiResponse)

		var newAPIError *types.NewAPIError
		if geminiResponse.PromptFeedback != nil && geminiResponse.PromptFeedback.BlockReason != nil {
			common.SetContextKey(c, constant.ContextKeyAdminRejectReason, fmt.Sprintf("gemini_block_reason=%s", *geminiResponse.PromptFeedback.BlockReason))
			newAPIError = types.NewOpenAIError(
				errors.New("request blocked by Gemini API: "+*geminiResponse.PromptFeedback.BlockReason),
				types.ErrorCodePromptBlocked,
				http.StatusBadRequest,
			)
		} else {
			common.SetContextKey(c, constant.ContextKeyAdminRejectReason, "gemini_empty_candidates")
			newAPIError = types.NewOpenAIError(
				errors.New("empty response from Gemini API"),
				types.ErrorCodeEmptyResponse,
				http.StatusInternalServerError,
			)
		}

		service.ResetStatusCode(newAPIError, c.GetString("status_code_mapping"))

		switch info.RelayFormat {
		case types.RelayFormatClaude:
			c.JSON(newAPIError.StatusCode, gin.H{
				"type":  "error",
				"error": newAPIError.ToClaudeError(),
			})
		default:
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
		return &usage, nil
	}
	usage := buildUsageFromGeminiResponse(c, info, &geminiResponse)
	if writeErr := writeGeminiNativeBody(c, info, resp, &geminiResponse, responseBody); writeErr != nil {
		return nil, writeErr
	}
	return &usage, nil
}

func GeminiEmbeddingHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewOpenAIError(readErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	var geminiResponse dto.GeminiBatchEmbeddingResponse
	if jsonErr := common.Unmarshal(responseBody, &geminiResponse); jsonErr != nil {
		return nil, types.NewOpenAIError(jsonErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	// convert to openai format response
	openAIResponse := dto.OpenAIEmbeddingResponse{
		Object: "list",
		Data:   make([]dto.OpenAIEmbeddingResponseItem, 0, len(geminiResponse.Embeddings)),
		Model:  info.UpstreamModelName,
	}

	for i, embedding := range geminiResponse.Embeddings {
		openAIResponse.Data = append(openAIResponse.Data, dto.OpenAIEmbeddingResponseItem{
			Object:    "embedding",
			Embedding: embedding.Values,
			Index:     i,
		})
	}

	// calculate usage
	// https://ai.google.dev/gemini-api/docs/pricing?hl=zh-cn#text-embedding-004
	// Google has not yet clarified how embedding models will be billed
	// refer to openai billing method to use input tokens billing
	// https://platform.openai.com/docs/guides/embeddings#what-are-embeddings
	usage := service.ResponseText2Usage(c, "", info.UpstreamModelName, info.GetEstimatePromptTokens())
	openAIResponse.Usage = *usage

	jsonResponse, jsonErr := common.Marshal(openAIResponse)
	if jsonErr != nil {
		return nil, types.NewOpenAIError(jsonErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	service.IOCopyBytesGracefully(c, resp, jsonResponse)
	return usage, nil
}

func IsImageAPIRelay(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return false
	}
	if info.RelayFormat == types.RelayFormatOpenAIImage {
		return true
	}
	switch info.RelayMode {
	case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits:
		return true
	default:
		return false
	}
}

func HandleGeminiImageAPIResponse(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if relayconvert.IsImagenPredictModel(info.UpstreamModelName) {
		return GeminiImageHandler(c, info, resp)
	}
	return GeminiGenerateContentImageHandler(c, info, resp)
}

func GeminiGenerateContentImageHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	responseBody, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewOpenAIError(readErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	var geminiResponse dto.GeminiChatResponse
	if jsonErr := common.Unmarshal(responseBody, &geminiResponse); jsonErr != nil {
		return nil, types.NewOpenAIError(jsonErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	convertResult, err := relayconvert.ConvertResponse(c, info, types.RelayFormatOpenAIImage, &geminiResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	imageResponse, ok := convertResult.Value.(*dto.ImageResponse)
	if !ok {
		return nil, types.NewOpenAIError(fmt.Errorf("expected OpenAI image response, got %T", convertResult.Value), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	jsonResponse, jsonErr := common.Marshal(imageResponse)
	if jsonErr != nil {
		return nil, types.NewError(jsonErr, types.ErrorCodeBadResponseBody)
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, _ = c.Writer.Write(jsonResponse)

	usage := convertResult.Usage
	if usage == nil {
		usage = &dto.Usage{}
	}
	return usage, nil
}

func GeminiImageHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	responseBody, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewOpenAIError(readErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	var geminiResponse dto.GeminiImageResponse
	if jsonErr := common.Unmarshal(responseBody, &geminiResponse); jsonErr != nil {
		return nil, types.NewOpenAIError(jsonErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if len(geminiResponse.Predictions) == 0 {
		return nil, types.NewOpenAIError(errors.New("no images generated"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	// convert to openai format response
	openAIResponse := dto.ImageResponse{
		Created: common.GetTimestamp(),
		Data:    make([]dto.ImageData, 0, len(geminiResponse.Predictions)),
	}

	for _, prediction := range geminiResponse.Predictions {
		if prediction.RaiFilteredReason != "" {
			continue // skip filtered image
		}
		openAIResponse.Data = append(openAIResponse.Data, dto.ImageData{
			B64Json: prediction.BytesBase64Encoded,
		})
	}

	jsonResponse, jsonErr := common.Marshal(openAIResponse)
	if jsonErr != nil {
		return nil, types.NewError(jsonErr, types.ErrorCodeBadResponseBody)
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, _ = c.Writer.Write(jsonResponse)

	// https://github.com/google-gemini/cookbook/blob/719a27d752aac33f39de18a8d3cb42a70874917e/quickstarts/Counting_Tokens.ipynb
	// each image has fixed 258 tokens
	const imageTokens = 258
	generatedImages := len(openAIResponse.Data)

	usage := &dto.Usage{
		PromptTokens:     imageTokens * generatedImages, // each generated image has fixed 258 tokens
		CompletionTokens: 0,                             // image generation does not calculate completion tokens
		TotalTokens:      imageTokens * generatedImages,
	}

	return usage, nil
}

type GeminiModelsResponse struct {
	Models        []dto.GeminiModel `json:"models"`
	NextPageToken string            `json:"nextPageToken"`
}

func FetchGeminiModels(baseURL, apiKey, proxyURL string) ([]string, error) {
	client, err := service.GetHttpClientWithProxy(proxyURL)
	if err != nil {
		return nil, fmt.Errorf("创建HTTP客户端失败: %v", err)
	}

	allModels := make([]string, 0)
	nextPageToken := ""
	maxPages := 100 // Safety limit to prevent infinite loops

	for page := 0; page < maxPages; page++ {
		url := fmt.Sprintf("%s/v1beta/models", baseURL)
		if nextPageToken != "" {
			url = fmt.Sprintf("%s?pageToken=%s", url, nextPageToken)
		}

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		request, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			cancel()
			return nil, fmt.Errorf("创建请求失败: %v", err)
		}

		request.Header.Set("x-goog-api-key", apiKey)

		response, err := client.Do(request)
		if err != nil {
			cancel()
			return nil, fmt.Errorf("请求失败: %v", err)
		}

		if response.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(response.Body)
			response.Body.Close()
			cancel()
			return nil, fmt.Errorf("服务器返回错误 %d: %s", response.StatusCode, string(body))
		}

		body, err := io.ReadAll(response.Body)
		response.Body.Close()
		cancel()
		if err != nil {
			return nil, fmt.Errorf("读取响应失败: %v", err)
		}

		var modelsResponse GeminiModelsResponse
		if err = common.Unmarshal(body, &modelsResponse); err != nil {
			return nil, fmt.Errorf("解析响应失败: %v", err)
		}

		for _, model := range modelsResponse.Models {
			modelNameValue := strings.TrimSpace(model.Name)
			if modelNameValue == "" {
				continue
			}
			modelName := strings.TrimPrefix(modelNameValue, "models/")
			allModels = append(allModels, modelName)
		}

		nextPageToken = modelsResponse.NextPageToken
		if nextPageToken == "" {
			break
		}
	}

	return allModels, nil
}
