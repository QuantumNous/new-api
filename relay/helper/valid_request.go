package helper

import (
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
)

var gptImage2AspectRatios = map[string]struct{}{
	"1:1":  {},
	"16:9": {},
	"9:16": {},
	"4:3":  {},
	"3:4":  {},
	"3:2":  {},
	"2:3":  {},
}

const (
	gptImage2MaxImages        = 6
	gptImage2OutputResolution = "1K"
)

func GetAndValidateRequest(c *gin.Context, format types.RelayFormat) (request dto.Request, err error) {
	relayMode := relayconstant.Path2RelayMode(c.Request.URL.Path)

	switch format {
	case types.RelayFormatOpenAI:
		request, err = GetAndValidateTextRequest(c, relayMode)
	case types.RelayFormatGemini:
		if strings.Contains(c.Request.URL.Path, ":embedContent") {
			request, err = GetAndValidateGeminiEmbeddingRequest(c)
		} else if strings.Contains(c.Request.URL.Path, ":batchEmbedContents") {
			request, err = GetAndValidateGeminiBatchEmbeddingRequest(c)
		} else {
			request, err = GetAndValidateGeminiRequest(c)
		}
	case types.RelayFormatClaude:
		request, err = GetAndValidateClaudeRequest(c)
	case types.RelayFormatOpenAIResponses:
		request, err = GetAndValidateResponsesRequest(c)
	case types.RelayFormatOpenAIResponsesCompaction:
		request, err = GetAndValidateResponsesCompactionRequest(c)

	case types.RelayFormatOpenAIImage:
		request, err = GetAndValidOpenAIImageRequest(c, relayMode)
	case types.RelayFormatEmbedding:
		request, err = GetAndValidateEmbeddingRequest(c, relayMode)
	case types.RelayFormatRerank:
		request, err = GetAndValidateRerankRequest(c)
	case types.RelayFormatOpenAIAudio:
		request, err = GetAndValidAudioRequest(c, relayMode)
	case types.RelayFormatOpenAIRealtime:
		request = &dto.BaseRequest{}
	default:
		return nil, fmt.Errorf("unsupported relay format: %s", format)
	}
	return request, err
}

func GetAndValidAudioRequest(c *gin.Context, relayMode int) (*dto.AudioRequest, error) {
	audioRequest := &dto.AudioRequest{}
	err := common.UnmarshalBodyReusable(c, audioRequest)
	if err != nil {
		return nil, err
	}
	switch relayMode {
	case relayconstant.RelayModeAudioSpeech:
		if audioRequest.Model == "" {
			return nil, errors.New("model is required")
		}
	default:
		if audioRequest.Model == "" {
			return nil, errors.New("model is required")
		}
		if audioRequest.ResponseFormat == "" {
			audioRequest.ResponseFormat = "json"
		}
	}
	return audioRequest, nil
}

func GetAndValidateRerankRequest(c *gin.Context) (*dto.RerankRequest, error) {
	var rerankRequest *dto.RerankRequest
	err := common.UnmarshalBodyReusable(c, &rerankRequest)
	if err != nil {
		logger.LogError(c, fmt.Sprintf("getAndValidateTextRequest failed: %s", err.Error()))
		return nil, types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	if rerankRequest.Query == "" {
		return nil, types.NewError(fmt.Errorf("query is empty"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	if len(rerankRequest.Documents) == 0 {
		return nil, types.NewError(fmt.Errorf("documents is empty"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	return rerankRequest, nil
}

func GetAndValidateEmbeddingRequest(c *gin.Context, relayMode int) (*dto.EmbeddingRequest, error) {
	var embeddingRequest *dto.EmbeddingRequest
	err := common.UnmarshalBodyReusable(c, &embeddingRequest)
	if err != nil {
		logger.LogError(c, fmt.Sprintf("getAndValidateTextRequest failed: %s", err.Error()))
		return nil, types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	if embeddingRequest.Input == nil {
		return nil, fmt.Errorf("input is empty")
	}
	if relayMode == relayconstant.RelayModeModerations && embeddingRequest.Model == "" {
		embeddingRequest.Model = "omni-moderation-latest"
	}
	if relayMode == relayconstant.RelayModeEmbeddings && embeddingRequest.Model == "" {
		embeddingRequest.Model = c.Param("model")
	}
	return embeddingRequest, nil
}

func GetAndValidateResponsesRequest(c *gin.Context) (*dto.OpenAIResponsesRequest, error) {
	request := &dto.OpenAIResponsesRequest{}
	err := common.UnmarshalBodyReusable(c, request)
	if err != nil {
		return nil, err
	}
	if request.Model == "" {
		return nil, errors.New("model is required")
	}
	if request.Input == nil {
		return nil, errors.New("input is required")
	}
	return request, nil
}

func GetAndValidateResponsesCompactionRequest(c *gin.Context) (*dto.OpenAIResponsesCompactionRequest, error) {
	request := &dto.OpenAIResponsesCompactionRequest{}
	if err := common.UnmarshalBodyReusable(c, request); err != nil {
		return nil, err
	}
	if request.Model == "" {
		return nil, errors.New("model is required")
	}
	return request, nil
}

func GetAndValidOpenAIImageRequest(c *gin.Context, relayMode int) (*dto.ImageRequest, error) {
	imageRequest := &dto.ImageRequest{}

	switch relayMode {
	case relayconstant.RelayModeImagesEdits:
		if strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
			_, err := c.MultipartForm()
			if err != nil {
				return nil, fmt.Errorf("failed to parse image edit form request: %w", err)
			}
			formData := c.Request.PostForm
			imageRequest.Prompt = formData.Get("prompt")
			imageRequest.Model = formData.Get("model")
			imageRequest.N = common.GetPointer(uint(common.String2Int(formData.Get("n"))))
			imageRequest.Quality = formData.Get("quality")
			imageRequest.Size = formData.Get("size")
			if imageValue := formData.Get("image"); imageValue != "" {
				imageRequest.Image, _ = common.Marshal(imageValue)
			}

			if imageRequest.Model == "gpt-image-1" {
				if imageRequest.Quality == "" {
					imageRequest.Quality = "standard"
				}
			}
			if imageRequest.N == nil || *imageRequest.N == 0 {
				imageRequest.N = common.GetPointer(uint(1))
			}

			hasWatermark := formData.Has("watermark")
			if hasWatermark {
				watermark := formData.Get("watermark") == "true"
				imageRequest.Watermark = &watermark
			}
			if err := validateGPTImage2Request(c, imageRequest); err != nil {
				return nil, err
			}
			break
		}
		fallthrough
	default:
		err := common.UnmarshalBodyReusable(c, imageRequest)
		if err != nil {
			return nil, err
		}

		if imageRequest.Model == "" {
			//imageRequest.Model = "dall-e-3"
			return nil, errors.New("model is required")
		}

		if strings.Contains(imageRequest.Size, "×") {
			return nil, errors.New("size an unexpected error occurred in the parameter, please use 'x' instead of the multiplication sign '×'")
		}

		// Not "256x256", "512x512", or "1024x1024"
		if imageRequest.Model == "dall-e-2" || imageRequest.Model == "dall-e" {
			if imageRequest.Size != "" && imageRequest.Size != "256x256" && imageRequest.Size != "512x512" && imageRequest.Size != "1024x1024" {
				return nil, errors.New("size must be one of 256x256, 512x512, or 1024x1024 for dall-e-2 or dall-e")
			}
			if imageRequest.Size == "" {
				imageRequest.Size = "1024x1024"
			}
		} else if imageRequest.Model == "dall-e-3" {
			if imageRequest.Size != "" && imageRequest.Size != "1024x1024" && imageRequest.Size != "1024x1792" && imageRequest.Size != "1792x1024" {
				return nil, errors.New("size must be one of 1024x1024, 1024x1792 or 1792x1024 for dall-e-3")
			}
			if imageRequest.Quality == "" {
				imageRequest.Quality = "standard"
			}
			if imageRequest.Size == "" {
				imageRequest.Size = "1024x1024"
			}
		} else if imageRequest.Model == "gpt-image-1" {
			if imageRequest.Quality == "" {
				imageRequest.Quality = "auto"
			}
		}
		if err := validateGPTImage2Request(c, imageRequest); err != nil {
			return nil, err
		}

		//if imageRequest.Prompt == "" {
		//	return nil, errors.New("prompt is required")
		//}

		if imageRequest.N == nil || *imageRequest.N == 0 {
			imageRequest.N = common.GetPointer(uint(1))
		}
	}

	return imageRequest, nil
}

func validateGPTImage2Request(c *gin.Context, imageRequest *dto.ImageRequest) error {
	if imageRequest == nil || !strings.EqualFold(strings.TrimSpace(imageRequest.Model), "gpt-image2") {
		return nil
	}

	if err := validateGPTImage2AspectRatio("size", imageRequest.Size); err != nil {
		return err
	}
	if err := validateGPTImage2AspectRatio("aspect_ratio", imageRequest.AspectRatio); err != nil {
		return err
	}
	if strings.TrimSpace(imageRequest.AspectRatio) == "" && strings.Contains(imageRequest.Size, ":") {
		imageRequest.AspectRatio = strings.TrimSpace(imageRequest.Size)
	}
	if strings.TrimSpace(imageRequest.OutputResolution) == "" {
		imageRequest.OutputResolution = gptImage2OutputResolution
	} else if !strings.EqualFold(strings.TrimSpace(imageRequest.OutputResolution), gptImage2OutputResolution) {
		return fmt.Errorf("output_resolution must be %s for gpt-image2", gptImage2OutputResolution)
	}

	imageCount := countGPTImage2JSONImages(imageRequest.ImageUrls) + countGPTImage2JSONImages(imageRequest.Image)
	if multipartCount := countGPTImage2MultipartImages(c); multipartCount > 0 {
		imageCount = multipartCount
	}
	if imageCount > gptImage2MaxImages {
		return fmt.Errorf("gpt-image2 supports at most %d uploaded images", gptImage2MaxImages)
	}
	if err := normalizeGPTImage2ReferenceMessages(imageRequest); err != nil {
		return err
	}
	return nil
}

func validateGPTImage2AspectRatio(fieldName string, value string) error {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	if _, ok := gptImage2AspectRatios[value]; ok {
		return nil
	}
	return fmt.Errorf("%s must be one of 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, or 2:3 for gpt-image2", fieldName)
}

func countGPTImage2JSONImages(raw []byte) int {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" || trimmed == "null" {
		return 0
	}

	var items []any
	if err := common.Unmarshal(raw, &items); err == nil {
		return len(items)
	}
	return 1
}

func countGPTImage2MultipartImages(c *gin.Context) int {
	if c == nil || c.Request == nil || c.Request.MultipartForm == nil {
		return 0
	}

	count := 0
	for fieldName, files := range c.Request.MultipartForm.File {
		if fieldName == "image" || fieldName == "image[]" || strings.HasPrefix(fieldName, "image[") {
			count += len(files)
		}
	}
	return count
}

func normalizeGPTImage2ReferenceMessages(imageRequest *dto.ImageRequest) error {
	if hasRawJSONValue(imageRequest.Messages) {
		return nil
	}

	imageUrls := collectGPTImage2ReferenceImageURLs(imageRequest.ImageUrls)
	imageUrls = append(imageUrls, collectGPTImage2ReferenceImageURLs(imageRequest.Image)...)
	if len(imageUrls) == 0 {
		return nil
	}

	prompt := strings.TrimSpace(imageRequest.Prompt)
	if prompt == "" {
		prompt = "Edit the provided media."
	}
	content := make([]map[string]any, 0, len(imageUrls)+1)
	content = append(content, map[string]any{
		"type": "text",
		"text": prompt,
	})
	for _, imageUrl := range imageUrls {
		content = append(content, map[string]any{
			"type": "image_url",
			"image_url": map[string]any{
				"url": imageUrl,
			},
		})
	}

	messages, err := common.Marshal([]map[string]any{
		{
			"role":    "user",
			"content": content,
		},
	})
	if err != nil {
		return err
	}
	imageRequest.Messages = messages
	imageRequest.ImageUrls = nil
	imageRequest.Image = nil
	return nil
}

func collectGPTImage2ReferenceImageURLs(raw []byte) []string {
	if !hasRawJSONValue(raw) {
		return nil
	}

	var urls []string
	if err := common.Unmarshal(raw, &urls); err == nil {
		return compactGPTImage2ReferenceImageURLs(urls)
	}

	var url string
	if err := common.Unmarshal(raw, &url); err == nil {
		return compactGPTImage2ReferenceImageURLs([]string{url})
	}

	var items []map[string]any
	if err := common.Unmarshal(raw, &items); err == nil {
		for _, item := range items {
			if url := extractGPTImage2ImageURLValue(item["url"]); url != "" {
				urls = append(urls, url)
				continue
			}
			if url := extractGPTImage2ImageURLValue(item["image_url"]); url != "" {
				urls = append(urls, url)
			}
		}
	}
	return compactGPTImage2ReferenceImageURLs(urls)
}

func extractGPTImage2ImageURLValue(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case map[string]any:
		if url, ok := typed["url"].(string); ok {
			return strings.TrimSpace(url)
		}
	}
	return ""
}

func compactGPTImage2ReferenceImageURLs(urls []string) []string {
	result := make([]string, 0, len(urls))
	for _, url := range urls {
		url = strings.TrimSpace(url)
		if url != "" {
			result = append(result, url)
		}
	}
	return result
}

func hasRawJSONValue(raw []byte) bool {
	trimmed := strings.TrimSpace(string(raw))
	return trimmed != "" && trimmed != "null"
}

func GetAndValidateClaudeRequest(c *gin.Context) (textRequest *dto.ClaudeRequest, err error) {
	textRequest = &dto.ClaudeRequest{}
	err = common.UnmarshalBodyReusable(c, textRequest)
	if err != nil {
		return nil, err
	}
	if textRequest.Messages == nil || len(textRequest.Messages) == 0 {
		return nil, errors.New("field messages is required")
	}
	if textRequest.Model == "" {
		return nil, errors.New("field model is required")
	}

	//if textRequest.Stream {
	//	relayInfo.IsStream = true
	//}

	return textRequest, nil
}

func GetAndValidateTextRequest(c *gin.Context, relayMode int) (*dto.GeneralOpenAIRequest, error) {
	textRequest := &dto.GeneralOpenAIRequest{}
	err := common.UnmarshalBodyReusable(c, textRequest)
	if err != nil {
		return nil, err
	}

	if relayMode == relayconstant.RelayModeModerations && textRequest.Model == "" {
		textRequest.Model = "text-moderation-latest"
	}
	if relayMode == relayconstant.RelayModeEmbeddings && textRequest.Model == "" {
		textRequest.Model = c.Param("model")
	}

	if lo.FromPtrOr(textRequest.MaxTokens, uint(0)) > math.MaxInt32/2 {
		return nil, errors.New("max_tokens is invalid")
	}
	if textRequest.Model == "" {
		return nil, errors.New("model is required")
	}
	if textRequest.WebSearchOptions != nil {
		if textRequest.WebSearchOptions.SearchContextSize != "" {
			validSizes := map[string]bool{
				"high":   true,
				"medium": true,
				"low":    true,
			}
			if !validSizes[textRequest.WebSearchOptions.SearchContextSize] {
				return nil, errors.New("invalid search_context_size, must be one of: high, medium, low")
			}
		} else {
			textRequest.WebSearchOptions.SearchContextSize = "medium"
		}
	}
	switch relayMode {
	case relayconstant.RelayModeCompletions:
		if textRequest.Prompt == "" {
			return nil, errors.New("field prompt is required")
		}
	case relayconstant.RelayModeChatCompletions:
		// For FIM (Fill-in-the-middle) requests with prefix/suffix, messages is optional
		// It will be filled by provider-specific adaptors if needed (e.g., SiliconFlow)。Or it is allowed by model vendor(s) (e.g., DeepSeek)
		if len(textRequest.Messages) == 0 && textRequest.Prefix == nil && textRequest.Suffix == nil {
			return nil, errors.New("field messages is required")
		}
	case relayconstant.RelayModeEmbeddings:
	case relayconstant.RelayModeModerations:
		if textRequest.Input == nil || textRequest.Input == "" {
			return nil, errors.New("field input is required")
		}
	case relayconstant.RelayModeEdits:
		if textRequest.Instruction == "" {
			return nil, errors.New("field instruction is required")
		}
	}
	return textRequest, nil
}

func GetAndValidateGeminiRequest(c *gin.Context) (*dto.GeminiChatRequest, error) {
	request := &dto.GeminiChatRequest{}
	err := common.UnmarshalBodyReusable(c, request)
	if err != nil {
		return nil, err
	}
	if len(request.Contents) == 0 && len(request.Requests) == 0 {
		return nil, errors.New("contents is required")
	}

	//if c.Query("alt") == "sse" {
	//	relayInfo.IsStream = true
	//}

	return request, nil
}

func GetAndValidateGeminiEmbeddingRequest(c *gin.Context) (*dto.GeminiEmbeddingRequest, error) {
	request := &dto.GeminiEmbeddingRequest{}
	err := common.UnmarshalBodyReusable(c, request)
	if err != nil {
		return nil, err
	}
	return request, nil
}

func GetAndValidateGeminiBatchEmbeddingRequest(c *gin.Context) (*dto.GeminiBatchEmbeddingRequest, error) {
	request := &dto.GeminiBatchEmbeddingRequest{}
	err := common.UnmarshalBodyReusable(c, request)
	if err != nil {
		return nil, err
	}
	return request, nil
}
