package gemini

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service/relayconvert"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/reasoning"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

type Adaptor struct {
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	if len(request.Contents) > 0 {
		for i, content := range request.Contents {
			if i == 0 {
				if request.Contents[0].Role == "" {
					request.Contents[0].Role = "user"
				}
			}
			for _, part := range content.Parts {
				if part.FileData != nil {
					if part.FileData.MimeType == "" && strings.Contains(part.FileData.FileUri, "www.youtube.com") {
						part.FileData.MimeType = "video/webm"
					}
				}
			}
		}
	}
	return request, nil
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ClaudeRequest) (any, error) {
	result, err := relayconvert.ConvertRequest(c, info, types.RelayFormatGemini, req)
	if err != nil {
		return nil, err
	}
	geminiRequest, ok := result.Value.(*dto.GeminiChatRequest)
	if !ok {
		return nil, fmt.Errorf("expected Gemini generateContent request, got %T", result.Value)
	}
	return geminiRequest, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

type nativeImageConfig struct {
	AspectRatio string
	ImageSize   string
}

func nativeImageSizeMapping(size string) (nativeImageConfig, bool) {
	switch strings.TrimSpace(size) {
	case "256x256", "1024x1024":
		return nativeImageConfig{AspectRatio: "1:1"}, true
	case "512x512":
		return nativeImageConfig{AspectRatio: "1:1", ImageSize: "512"}, true
	case "1536x864":
		return nativeImageConfig{AspectRatio: "16:9"}, true
	case "864x1536":
		return nativeImageConfig{AspectRatio: "9:16"}, true
	case "1024x1360":
		return nativeImageConfig{AspectRatio: "3:4"}, true
	case "1360x1024":
		return nativeImageConfig{AspectRatio: "4:3"}, true
	case "1440x1440":
		return nativeImageConfig{AspectRatio: "1:1", ImageSize: "2K"}, true
	case "2048x1152":
		return nativeImageConfig{AspectRatio: "16:9", ImageSize: "2K"}, true
	case "1152x2048":
		return nativeImageConfig{AspectRatio: "9:16", ImageSize: "2K"}, true
	case "1248x1664":
		return nativeImageConfig{AspectRatio: "3:4", ImageSize: "2K"}, true
	case "1664x1248":
		return nativeImageConfig{AspectRatio: "4:3", ImageSize: "2K"}, true
	case "2880x2880":
		return nativeImageConfig{AspectRatio: "1:1", ImageSize: "4K"}, true
	case "3840x2160":
		return nativeImageConfig{AspectRatio: "16:9", ImageSize: "4K"}, true
	case "2160x3840":
		return nativeImageConfig{AspectRatio: "9:16", ImageSize: "4K"}, true
	case "2448x3264":
		return nativeImageConfig{AspectRatio: "3:4", ImageSize: "4K"}, true
	case "3264x2448":
		return nativeImageConfig{AspectRatio: "4:3", ImageSize: "4K"}, true
	case "832x1248":
		return nativeImageConfig{AspectRatio: "2:3"}, true
	case "1248x832":
		return nativeImageConfig{AspectRatio: "3:2"}, true
	case "864x1184":
		return nativeImageConfig{AspectRatio: "3:4"}, true
	case "1184x864":
		return nativeImageConfig{AspectRatio: "4:3"}, true
	case "896x1152":
		return nativeImageConfig{AspectRatio: "4:5"}, true
	case "1152x896":
		return nativeImageConfig{AspectRatio: "5:4"}, true
	case "768x1344":
		return nativeImageConfig{AspectRatio: "9:16"}, true
	case "1344x768":
		return nativeImageConfig{AspectRatio: "16:9"}, true
	case "1536x672":
		return nativeImageConfig{AspectRatio: "21:9"}, true
	case "1536x1024":
		return nativeImageConfig{AspectRatio: "3:2"}, true
	case "1024x1536":
		return nativeImageConfig{AspectRatio: "2:3"}, true
	case "1024x1792":
		return nativeImageConfig{AspectRatio: "9:16"}, true
	case "1792x1024":
		return nativeImageConfig{AspectRatio: "16:9"}, true
	case "2048x2048":
		return nativeImageConfig{AspectRatio: "1:1", ImageSize: "2K"}, true
	case "4096x4096":
		return nativeImageConfig{AspectRatio: "1:1", ImageSize: "4K"}, true
	case "auto", "":
		return nativeImageConfig{}, true
	default:
		return nativeImageConfig{}, false
	}
}

func nativeImageQualitySize(quality string) string {
	switch strings.ToLower(strings.TrimSpace(quality)) {
	case "512", "0.5k":
		return "512"
	case "hd", "high", "2k":
		return "2K"
	case "4k":
		return "4K"
	case "standard", "medium", "low", "auto", "1k":
		return "1K"
	default:
		return ""
	}
}

// nativeImageConfigForRequest maps both legacy OpenAI size/quality fields and
// the unified image API's explicit aspect_ratio/resolution fields. Explicit
// unified values win over inferred values from size and quality.
func nativeImageConfigForRequest(request dto.ImageRequest) (map[string]string, error) {
	frozenRequirement, hasFrozenRequirement := request.ImageSelectionRequirement()
	size := request.Size
	if strings.TrimSpace(size) == "" && hasFrozenRequirement {
		size = frozenRequirement.Size
	}
	config, knownSize := nativeImageSizeMapping(size)
	if strings.TrimSpace(size) != "" && !knownSize {
		return nil, fmt.Errorf("unsupported image size %q", size)
	}
	if quality := strings.TrimSpace(request.Quality); quality != "" {
		qualitySize := nativeImageQualitySize(quality)
		if qualitySize == "" {
			return nil, fmt.Errorf("unsupported image quality %q", request.Quality)
		}
		// Explicit pixel sizes that encode a resolution tier are authoritative.
		// Applying quality=auto after size=3840x2160 must not silently turn a 4K
		// request into 1K.
		if config.ImageSize == "" {
			config.ImageSize = qualitySize
		}
	}
	if hasFrozenRequirement {
		if config.AspectRatio == "" {
			config.AspectRatio = strings.ToLower(strings.TrimSpace(frozenRequirement.AspectRatio))
		}
		if config.ImageSize == "" {
			config.ImageSize = strings.ToUpper(strings.TrimSpace(frozenRequirement.Resolution))
		}
	}

	for _, field := range []string{"aspect_ratio", "aspectRatio"} {
		raw, ok := request.Extra[field]
		if !ok {
			continue
		}
		var aspectRatio string
		if err := common.Unmarshal(raw, &aspectRatio); err != nil {
			return nil, fmt.Errorf("invalid %s: %w", field, err)
		}
		if value := strings.ToLower(strings.TrimSpace(aspectRatio)); value != "" {
			if !common.IsKnownNativeImageAspectRatio(value) {
				return nil, fmt.Errorf("unsupported aspect_ratio %q", value)
			}
			config.AspectRatio = value
		}
		break
	}

	for _, field := range []string{"resolution", "image_size", "imageSize"} {
		raw, ok := request.Extra[field]
		if !ok {
			continue
		}
		var imageSize string
		if err := common.Unmarshal(raw, &imageSize); err != nil {
			return nil, fmt.Errorf("invalid %s: %w", field, err)
		}
		if value := strings.ToUpper(strings.TrimSpace(imageSize)); value != "" {
			if !common.IsKnownNativeImageResolution(value) {
				return nil, fmt.Errorf("unsupported resolution %q", value)
			}
			config.ImageSize = value
		}
		break
	}

	imageConfig := make(map[string]string, 2)
	if config.AspectRatio != "" {
		imageConfig["aspect_ratio"] = config.AspectRatio
	}
	if config.ImageSize != "" {
		imageConfig["image_size"] = config.ImageSize
	}
	return imageConfig, nil
}

// ValidateNativeImageRequestOptions performs the option-only part of native
// image conversion. It deliberately does not resolve reference image URLs, so
// callers can reject malformed aspect/resolution values before staging input
// images in object storage.
func ValidateNativeImageRequestOptions(request dto.ImageRequest) error {
	return ValidateNativeImageRequestOptionsForModel(request, request.Model)
}

// ValidateNativeImageRequestOptionsForModel also enforces the resolution tier
// exposed by the selected Gemini image model. Older image models accept only
// 1K; the Nano Banana and Gemini 3 image families expose the higher tiers.
func ValidateNativeImageRequestOptionsForModel(request dto.ImageRequest, model string) error {
	config, err := nativeImageConfigForRequest(request)
	if err != nil {
		return err
	}
	capabilities := nativeImageModelCapabilities(model)
	if aspectRatio := config["aspect_ratio"]; aspectRatio != "" && !capabilities.SupportsAspectRatio(aspectRatio) {
		return fmt.Errorf("aspect_ratio %s is not supported by model %s", aspectRatio, model)
	}
	requested := common.ImageResolutionRank(config["image_size"])
	if requested == 0 {
		return nil
	}
	if strings.EqualFold(config["image_size"], "512") && !capabilities.SupportsResolution("512") {
		return fmt.Errorf("resolution 512 is not supported by model %s (minimum 1K)", model)
	}
	maximum := common.ImageResolutionRank(capabilities.MaxResolution())
	if requested > maximum {
		return fmt.Errorf("resolution %s is not supported by model %s (maximum %s)", config["image_size"], model, maxNativeImageResolution(model))
	}
	return nil
}

func maxNativeImageResolution(model string) string {
	return nativeImageModelCapabilities(model).MaxResolution()
}

func nativeImageModelCapabilities(model string) common.ImageModelCapabilities {
	capabilities := common.ImageModelCapabilitiesForModel(model)
	if capabilities.Family == common.ImageModelFamilyGeneric {
		return common.ImageModelCapabilitiesForModel("gemini-2.5-flash-image")
	}
	return capabilities
}

func nativeImageMessageContent(request dto.ImageRequest) (any, error) {
	imageURLs, err := request.ImageInputURLs()
	if err != nil {
		return nil, err
	}
	if len(imageURLs) == 0 {
		if len(strings.TrimSpace(string(request.Image))) > 0 && common.GetJsonType(request.Image) != "null" {
			probe := request
			probe.Images = append(json.RawMessage(nil), request.Image...)
			imageURLs, err = probe.ImageInputURLs()
			if err != nil {
				return nil, fmt.Errorf("invalid image: %w", err)
			}
		}
		if len(imageURLs) == 0 {
			return request.Prompt, nil
		}
	}

	content := make([]any, 0, len(imageURLs)+1)
	content = append(content, dto.MediaContent{
		Type: dto.ContentTypeText,
		Text: request.Prompt,
	})
	for _, imageURL := range imageURLs {
		content = append(content, dto.MediaContent{
			Type:     dto.ContentTypeImageURL,
			ImageUrl: &dto.MessageImageUrl{Url: imageURL},
		})
	}
	return content, nil
}

func (a *Adaptor) convertNativeImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	model := request.Model
	if model == "" {
		model = info.UpstreamModelName
	}
	if err := ValidateNativeImageRequestOptionsForModel(request, model); err != nil {
		return nil, err
	}
	content, err := nativeImageMessageContent(request)
	if err != nil {
		return nil, err
	}
	imageConfig, err := nativeImageConfigForRequest(request)
	if err != nil {
		return nil, err
	}
	// relayconvert expects the OpenAI-compatible extra_body.google.image_config
	// shape and maps it to Gemini's camelCase generationConfig fields. Keep the
	// response modalities in the generated request's standard config.
	extraBody, err := common.Marshal(map[string]any{
		"google": map[string]any{
			"image_config": imageConfig,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("marshal Gemini image configuration: %w", err)
	}

	chatRequest := dto.GeneralOpenAIRequest{
		Model: model,
		Messages: []dto.Message{
			{Role: "user", Content: content},
		},
		ExtraBody: extraBody,
	}
	if request.N != nil {
		count := int(*request.N)
		chatRequest.N = &count
	}
	return a.ConvertOpenAIRequest(c, info, &chatRequest)
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) {
		return a.convertNativeImageRequest(c, info, request)
	}
	upstreamModel := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(info.UpstreamModelName)), "models/")
	if !strings.HasPrefix(upstreamModel, "imagen-") {
		return nil, errors.New("not supported model for image generation, only imagen models are supported")
	}
	capabilities := common.ImageModelCapabilitiesForModel(upstreamModel)
	frozenRequirement, hasFrozenRequirement := request.ImageSelectionRequirement()

	// Preserve the legacy OpenAI size aliases while allowing the unified
	// aspect_ratio field to override them.
	aspectRatio := capabilities.DefaultAspectRatio
	size := strings.TrimSpace(request.Size)
	if size == "" && hasFrozenRequirement {
		size = strings.TrimSpace(frozenRequirement.Size)
	}
	if size != "" {
		if strings.Contains(size, ":") {
			candidate := strings.ToLower(size)
			if !capabilities.SupportsAspectRatio(candidate) {
				return nil, fmt.Errorf("aspect_ratio %s is not supported by model %s", candidate, upstreamModel)
			}
			aspectRatio = candidate
		} else {
			switch size {
			case "256x256", "512x512", "1024x1024":
				aspectRatio = "1:1"
			case "1536x1024":
				aspectRatio = "4:3"
			case "1024x1536":
				aspectRatio = "3:4"
			case "1024x1792":
				aspectRatio = "9:16"
			case "1792x1024":
				aspectRatio = "16:9"
			default:
				return nil, fmt.Errorf("size %s is not supported by model %s", size, upstreamModel)
			}
		}
	}
	if raw, ok := request.Extra["aspect_ratio"]; ok {
		var value string
		if err := common.Unmarshal(raw, &value); err != nil {
			return nil, fmt.Errorf("aspect_ratio must be a string: %w", err)
		}
		value = strings.ToLower(strings.TrimSpace(value))
		if !capabilities.SupportsAspectRatio(value) {
			return nil, fmt.Errorf("aspect_ratio %s is not supported by model %s", value, upstreamModel)
		}
		aspectRatio = value
	} else if hasFrozenRequirement && frozenRequirement.AspectRatio != "" {
		aspectRatio = strings.ToLower(strings.TrimSpace(frozenRequirement.AspectRatio))
	}

	imageSize := ""
	if quality := strings.TrimSpace(request.Quality); quality != "" {
		switch strings.ToLower(quality) {
		case "auto", "standard", "medium", "low", "1k":
			imageSize = "1K"
		case "hd", "high", "2k":
			imageSize = "2K"
		default:
			return nil, fmt.Errorf("quality %s is not supported by model %s", quality, upstreamModel)
		}
	}
	if raw, ok := request.Extra["resolution"]; ok {
		var value string
		if err := common.Unmarshal(raw, &value); err != nil {
			return nil, fmt.Errorf("resolution must be a string: %w", err)
		}
		value = strings.ToUpper(strings.TrimSpace(value))
		if !capabilities.SupportsResolution(value) {
			return nil, fmt.Errorf("resolution %s is not supported by model %s", value, upstreamModel)
		}
		imageSize = value
	} else if hasFrozenRequirement && frozenRequirement.Resolution != "" {
		imageSize = strings.ToUpper(strings.TrimSpace(frozenRequirement.Resolution))
	}

	// build gemini imagen request
	geminiRequest := dto.GeminiImageRequest{
		Instances: []dto.GeminiImageInstance{
			{
				Prompt: request.Prompt,
			},
		},
		Parameters: dto.GeminiImageParameters{
			SampleCount:      int(lo.FromPtrOr(request.N, uint(1))),
			AspectRatio:      aspectRatio,
			PersonGeneration: "allow_adult", // default allow adult
			ImageSize:        imageSize,
		},
	}

	return geminiRequest, nil
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {

}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	info.UpstreamModelName = normalizeGeminiModelName(info.UpstreamModelName)

	if model_setting.GetGeminiSettings().ThinkingAdapterEnabled &&
		!model_setting.ShouldPreserveThinkingSuffix(info.OriginModelName) {
		// 新增逻辑：处理 -thinking-<budget> 格式
		if strings.Contains(info.UpstreamModelName, "-thinking-") {
			parts := strings.Split(info.UpstreamModelName, "-thinking-")
			info.UpstreamModelName = parts[0]
		} else if strings.HasSuffix(info.UpstreamModelName, "-thinking") { // 旧的适配
			info.UpstreamModelName = strings.TrimSuffix(info.UpstreamModelName, "-thinking")
		} else if strings.HasSuffix(info.UpstreamModelName, "-nothinking") {
			info.UpstreamModelName = strings.TrimSuffix(info.UpstreamModelName, "-nothinking")
		} else if baseModel, level, ok := reasoning.TrimEffortSuffix(info.UpstreamModelName); ok && level != "" {
			info.UpstreamModelName = baseModel
		}
	}

	version := model_setting.GetGeminiVersionSetting(info.UpstreamModelName)

	if strings.HasPrefix(info.UpstreamModelName, "imagen") {
		return fmt.Sprintf("%s/%s/models/%s:predict", info.ChannelBaseUrl, version, info.UpstreamModelName), nil
	}

	if strings.HasPrefix(info.UpstreamModelName, "text-embedding") ||
		strings.HasPrefix(info.UpstreamModelName, "embedding") ||
		strings.HasPrefix(info.UpstreamModelName, "gemini-embedding") {
		action := "embedContent"
		if info.IsGeminiBatchEmbedding {
			action = "batchEmbedContents"
		}
		return fmt.Sprintf("%s/%s/models/%s:%s", info.ChannelBaseUrl, version, info.UpstreamModelName, action), nil
	}

	action := "generateContent"
	if info.IsStream {
		action = "streamGenerateContent?alt=sse"
		if info.RelayMode == constant.RelayModeGemini {
			info.DisablePing = true
		}
	}
	return fmt.Sprintf("%s/%s/models/%s:%s", info.ChannelBaseUrl, version, info.UpstreamModelName, action), nil
}

func normalizeGeminiModelName(model string) string {
	return strings.TrimPrefix(strings.ToLower(strings.TrimSpace(model)), "models/")
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("x-goog-api-key", info.ApiKey)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	result, err := relayconvert.ConvertRequest(c, info, types.RelayFormatGemini, request)
	if err != nil {
		return nil, err
	}
	return result.Value, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	if request.Input == nil {
		return nil, errors.New("input is required")
	}

	inputs := request.ParseInput()
	if len(inputs) == 0 {
		return nil, errors.New("input is empty")
	}
	// We always build a batch-style payload with `requests`, so ensure we call the
	// batch endpoint upstream to avoid payload/endpoint mismatches.
	info.IsGeminiBatchEmbedding = true
	// process all inputs
	geminiRequests := make([]map[string]interface{}, 0, len(inputs))
	for _, input := range inputs {
		geminiRequest := map[string]interface{}{
			"model": fmt.Sprintf("models/%s", info.UpstreamModelName),
			"content": dto.GeminiChatContent{
				Parts: []dto.GeminiPart{
					{
						Text: input,
					},
				},
			},
		}

		// set specific parameters for different models
		// https://ai.google.dev/api/embeddings?hl=zh-cn#method:-models.embedcontent
		switch info.UpstreamModelName {
		case "text-embedding-004", "gemini-embedding-exp-03-07", "gemini-embedding-001":
			// Only newer models introduced after 2024 support OutputDimensionality
			dimensions := lo.FromPtrOr(request.Dimensions, 0)
			if dimensions > 0 {
				geminiRequest["outputDimensionality"] = dimensions
			}
		}
		geminiRequests = append(geminiRequests, geminiRequest)
	}

	return map[string]interface{}{
		"requests": geminiRequests,
	}, nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	result, err := relayconvert.ConvertRequest(c, info, types.RelayFormatGemini, &request)
	if err != nil {
		return nil, err
	}
	geminiRequest, ok := result.Value.(*dto.GeminiChatRequest)
	if !ok {
		return nil, fmt.Errorf("expected Gemini generateContent request, got %T", result.Value)
	}
	return geminiRequest, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.RelayMode == constant.RelayModeResponses {
		if info.IsStream {
			return GeminiResponsesStreamHandler(c, info, resp)
		}
		return GeminiResponsesHandler(c, info, resp)
	}

	// The unified Images API needs an OpenAI image envelope, while native
	// Gemini and chat-completions callers must keep their original response
	// contracts even when they select an image-capable model.
	if (info.RelayMode == constant.RelayModeImagesGenerations || info.RelayMode == constant.RelayModeImagesEdits) &&
		model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) {
		return ChatImageHandler(c, info, resp)
	}

	if info.RelayMode == constant.RelayModeGemini {
		if strings.Contains(info.RequestURLPath, ":embedContent") ||
			strings.Contains(info.RequestURLPath, ":batchEmbedContents") {
			return NativeGeminiEmbeddingHandler(c, resp, info)
		}
		if info.IsStream {
			return GeminiTextGenerationStreamHandler(c, info, resp)
		} else {
			return GeminiTextGenerationHandler(c, info, resp)
		}
	}

	if strings.HasPrefix(info.UpstreamModelName, "imagen") {
		return GeminiImageHandler(c, info, resp)
	}

	// check if the model is an embedding model
	if strings.HasPrefix(info.UpstreamModelName, "text-embedding") ||
		strings.HasPrefix(info.UpstreamModelName, "embedding") ||
		strings.HasPrefix(info.UpstreamModelName, "gemini-embedding") {
		return GeminiEmbeddingHandler(c, info, resp)
	}

	if info.IsStream {
		return GeminiChatStreamHandler(c, info, resp)
	} else {
		return GeminiChatHandler(c, info, resp)
	}

}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
