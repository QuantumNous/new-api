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
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
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
	adaptor := openai.Adaptor{}
	oaiReq, err := adaptor.ConvertClaudeRequest(c, info, req)
	if err != nil {
		return nil, err
	}
	return a.ConvertOpenAIRequest(c, info, oaiReq.(*dto.GeneralOpenAIRequest))
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	// convert size to aspect ratio but allow user to specify aspect ratio
	aspectRatio := "1:1" // default aspect ratio
	size := strings.TrimSpace(request.Size)
	if size != "" {
		if strings.Contains(size, ":") {
			aspectRatio = size
		} else {
			switch size {
			case "256x256", "512x512", "1024x1024":
				aspectRatio = "1:1"
			case "1536x1024":
				aspectRatio = "3:2"
			case "1024x1536":
				aspectRatio = "2:3"
			case "1024x1792":
				aspectRatio = "9:16"
			case "1792x1024":
				aspectRatio = "16:9"
			}
		}
	}

	if !strings.HasPrefix(info.UpstreamModelName, "imagen") {
		geminiRequest := dto.GeminiChatRequest{
			Contents: []dto.GeminiChatContent{
				{
					Role: "user",
					Parts: []dto.GeminiPart{
						{Text: request.Prompt},
					},
				},
			},
			GenerationConfig: dto.GeminiChatGenerationConfig{
				ResponseModalities: []string{"TEXT", "IMAGE"},
			},
		}
		if request.N != nil && *request.N > 0 {
			candidateCount := int(*request.N)
			geminiRequest.GenerationConfig.CandidateCount = &candidateCount
		}
		imageConfig := map[string]any{
			"aspectRatio": aspectRatio,
		}
		if request.Quality != "" {
			switch request.Quality {
			case "hd", "high", "2K":
				imageConfig["imageSize"] = "2K"
			case "standard", "medium", "low", "auto", "1K":
				imageConfig["imageSize"] = "1K"
			}
		}
		imageConfigBytes, err := common.Marshal(imageConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal gemini image config: %w", err)
		}
		geminiRequest.GenerationConfig.ImageConfig = imageConfigBytes
		if err := applyGeminiImageExtraFields(request, &geminiRequest); err != nil {
			return nil, err
		}
		return geminiRequest, nil
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
		},
	}

	// Set imageSize when quality parameter is specified
	// Map quality parameter to imageSize (only supported by Standard and Ultra models)
	// quality values: auto, high, medium, low (for gpt-image-1), hd, standard (for dall-e-3)
	// imageSize values: 1K (default), 2K
	// https://ai.google.dev/gemini-api/docs/imagen
	// https://platform.openai.com/docs/api-reference/images/create
	if request.Quality != "" {
		imageSize := "1K" // default
		switch request.Quality {
		case "hd", "high":
			imageSize = "2K"
		case "2K":
			imageSize = "2K"
		case "standard", "medium", "low", "auto", "1K":
			imageSize = "1K"
		default:
			// unknown quality value, default to 1K
			imageSize = "1K"
		}
		geminiRequest.Parameters.ImageSize = imageSize
	}

	return geminiRequest, nil
}

func applyGeminiImageExtraFields(request dto.ImageRequest, geminiRequest *dto.GeminiChatRequest) error {
	if geminiRequest == nil {
		return nil
	}
	extraBodies := make([]json.RawMessage, 0, 3)
	if len(request.ExtraFields) > 0 {
		extraBodies = append(extraBodies, request.ExtraFields)
	}
	if request.Extra != nil {
		if body, ok := request.Extra["extra_body"]; ok && len(body) > 0 {
			extraBodies = append(extraBodies, body)
		}
		if google, ok := request.Extra["google"]; ok && len(google) > 0 {
			wrapped, err := common.Marshal(map[string]json.RawMessage{"google": google})
			if err != nil {
				return fmt.Errorf("failed to marshal google extra fields: %w", err)
			}
			extraBodies = append(extraBodies, wrapped)
		}
	}
	for _, body := range extraBodies {
		if err := applyGeminiImageExtraBody(body, geminiRequest); err != nil {
			return err
		}
	}
	if len(geminiRequest.GenerationConfig.ResponseModalities) == 0 {
		geminiRequest.GenerationConfig.ResponseModalities = []string{"TEXT", "IMAGE"}
	}
	return nil
}

func applyGeminiImageExtraBody(body json.RawMessage, geminiRequest *dto.GeminiChatRequest) error {
	var extra map[string]json.RawMessage
	if err := common.Unmarshal(body, &extra); err != nil {
		return fmt.Errorf("invalid gemini image extra fields: %w", err)
	}
	if raw, ok := extra["gemini"]; ok && len(raw) > 0 {
		if err := applyNativeGeminiImageExtra(raw, geminiRequest); err != nil {
			return err
		}
	}
	if raw, ok := extra["generationConfig"]; ok && len(raw) > 0 {
		if err := applyGeminiGenerationConfig(raw, geminiRequest); err != nil {
			return err
		}
	}
	if raw, ok := extra["generation_config"]; ok && len(raw) > 0 {
		if err := applyGeminiGenerationConfig(raw, geminiRequest); err != nil {
			return err
		}
	}
	if raw, ok := extra["google"]; ok && len(raw) > 0 {
		if err := applyGoogleImageConfig(raw, geminiRequest); err != nil {
			return err
		}
	}
	return nil
}

func applyNativeGeminiImageExtra(raw json.RawMessage, geminiRequest *dto.GeminiChatRequest) error {
	var extra struct {
		Contents               []dto.GeminiChatContent         `json:"contents"`
		SafetySettings         []dto.GeminiChatSafetySettings  `json:"safetySettings"`
		SafetySettingsSnake    []dto.GeminiChatSafetySettings  `json:"safety_settings"`
		GenerationConfig       *dto.GeminiChatGenerationConfig `json:"generationConfig"`
		GenerationConfigSnake  *dto.GeminiChatGenerationConfig `json:"generation_config"`
		Tools                  json.RawMessage                 `json:"tools"`
		ToolConfig             *dto.ToolConfig                 `json:"toolConfig"`
		ToolConfigSnake        *dto.ToolConfig                 `json:"tool_config"`
		SystemInstruction      *dto.GeminiChatContent          `json:"systemInstruction"`
		SystemInstructionSnake *dto.GeminiChatContent          `json:"system_instruction"`
		CachedContent          string                          `json:"cachedContent"`
		CachedContentSnake     string                          `json:"cached_content"`
	}
	if err := common.Unmarshal(raw, &extra); err != nil {
		return fmt.Errorf("invalid gemini image native extra fields: %w", err)
	}
	if len(extra.Contents) > 0 {
		geminiRequest.Contents = extra.Contents
	}
	if len(extra.SafetySettings) > 0 {
		geminiRequest.SafetySettings = extra.SafetySettings
	}
	if len(extra.SafetySettingsSnake) > 0 {
		geminiRequest.SafetySettings = extra.SafetySettingsSnake
	}
	if extra.GenerationConfig != nil {
		mergeGeminiGenerationConfig(geminiRequest, *extra.GenerationConfig)
	}
	if extra.GenerationConfigSnake != nil {
		mergeGeminiGenerationConfig(geminiRequest, *extra.GenerationConfigSnake)
	}
	if len(extra.Tools) > 0 {
		geminiRequest.Tools = extra.Tools
	}
	if extra.ToolConfig != nil {
		geminiRequest.ToolConfig = extra.ToolConfig
	}
	if extra.ToolConfigSnake != nil {
		geminiRequest.ToolConfig = extra.ToolConfigSnake
	}
	if extra.SystemInstruction != nil {
		geminiRequest.SystemInstructions = extra.SystemInstruction
	}
	if extra.SystemInstructionSnake != nil {
		geminiRequest.SystemInstructions = extra.SystemInstructionSnake
	}
	if extra.CachedContent != "" {
		geminiRequest.CachedContent = extra.CachedContent
	}
	if extra.CachedContentSnake != "" {
		geminiRequest.CachedContent = extra.CachedContentSnake
	}
	return nil
}

func applyGeminiGenerationConfig(raw json.RawMessage, geminiRequest *dto.GeminiChatRequest) error {
	var cfg dto.GeminiChatGenerationConfig
	if err := common.Unmarshal(raw, &cfg); err != nil {
		return fmt.Errorf("invalid gemini image generation config: %w", err)
	}
	mergeGeminiGenerationConfig(geminiRequest, cfg)
	return nil
}

func mergeGeminiGenerationConfig(geminiRequest *dto.GeminiChatRequest, cfg dto.GeminiChatGenerationConfig) {
	if len(cfg.ResponseModalities) == 0 {
		cfg.ResponseModalities = geminiRequest.GenerationConfig.ResponseModalities
	}
	if len(cfg.ImageConfig) == 0 {
		cfg.ImageConfig = geminiRequest.GenerationConfig.ImageConfig
	}
	if cfg.CandidateCount == nil {
		cfg.CandidateCount = geminiRequest.GenerationConfig.CandidateCount
	}
	geminiRequest.GenerationConfig = cfg
}

func applyGoogleImageConfig(raw json.RawMessage, geminiRequest *dto.GeminiChatRequest) error {
	var googleBody map[string]any
	if err := common.Unmarshal(raw, &googleBody); err != nil {
		return fmt.Errorf("invalid google image extra fields: %w", err)
	}
	if _, hasErrorParam := googleBody["imageConfig"]; hasErrorParam {
		return errors.New("extra_fields.google.imageConfig is not supported, use extra_fields.google.image_config instead")
	}
	imageConfig, ok := googleBody["image_config"].(map[string]any)
	if !ok {
		return nil
	}
	if _, hasErrorParam := imageConfig["aspectRatio"]; hasErrorParam {
		return errors.New("extra_fields.google.image_config.aspectRatio is not supported, use extra_fields.google.image_config.aspect_ratio instead")
	}
	if _, hasErrorParam := imageConfig["imageSize"]; hasErrorParam {
		return errors.New("extra_fields.google.image_config.imageSize is not supported, use extra_fields.google.image_config.image_size instead")
	}
	geminiImageConfig := make(map[string]any)
	if aspectRatio, ok := imageConfig["aspect_ratio"]; ok {
		geminiImageConfig["aspectRatio"] = aspectRatio
	}
	if imageSize, ok := imageConfig["image_size"]; ok {
		geminiImageConfig["imageSize"] = imageSize
	}
	if len(geminiImageConfig) == 0 {
		return nil
	}
	imageConfigBytes, err := common.Marshal(geminiImageConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal image_config: %w", err)
	}
	geminiRequest.GenerationConfig.ImageConfig = imageConfigBytes
	return nil
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {

}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {

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

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("x-goog-api-key", info.ApiKey)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}

	geminiRequest, err := CovertOpenAI2Gemini(c, *request, info)
	if err != nil {
		return nil, err
	}

	return geminiRequest, nil
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
	// TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
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

	if info.RelayMode == constant.RelayModeImagesGenerations || info.RelayMode == constant.RelayModeImagesEdits {
		return GeminiGeneratedImageHandler(c, info, resp)
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
