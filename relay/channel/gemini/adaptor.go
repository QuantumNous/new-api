package gemini

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
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

type ImageConfig struct {
	AspectRatio string `json:"aspectRatio,omitempty"`
	ImageSize   string `json:"imageSize,omitempty"`
}

type SizeMapping struct {
	AspectRatio string
	ImageSize   string
}

type QualityMapping struct {
	Standard string
	HD       string
	High     string
	FourK    string
	Auto     string
}

func getImageSizeMapping() QualityMapping {
	return QualityMapping{
		Standard: "1K",
		HD:       "2K",
		High:     "2K",
		FourK:    "4K",
		Auto:     "1K",
	}
}

func getSizeMappings() map[string]SizeMapping {
	return map[string]SizeMapping{
		// Gemini 2.5 Flash Image - default 1K resolutions
		"1024x1024": {AspectRatio: "1:1", ImageSize: ""},
		"832x1248":  {AspectRatio: "2:3", ImageSize: ""},
		"1248x832":  {AspectRatio: "3:2", ImageSize: ""},
		"864x1184":  {AspectRatio: "3:4", ImageSize: ""},
		"1184x864":  {AspectRatio: "4:3", ImageSize: ""},
		"896x1152":  {AspectRatio: "4:5", ImageSize: ""},
		"1152x896":  {AspectRatio: "5:4", ImageSize: ""},
		"768x1344":  {AspectRatio: "9:16", ImageSize: ""},
		"1344x768":  {AspectRatio: "16:9", ImageSize: ""},
		"1536x672":  {AspectRatio: "21:9", ImageSize: ""},

		// Gemini 3 Pro Image Preview resolutions
		"1536x1024": {AspectRatio: "3:2", ImageSize: ""},
		"1024x1536": {AspectRatio: "2:3", ImageSize: ""},
		"1024x1792": {AspectRatio: "9:16", ImageSize: ""},
		"1792x1024": {AspectRatio: "16:9", ImageSize: ""},
		"2048x2048": {AspectRatio: "1:1", ImageSize: "2K"},
		"4096x4096": {AspectRatio: "1:1", ImageSize: "4K"},
	}
}

func processSizeParameters(size, quality string) ImageConfig {
	config := ImageConfig{} // 默认为空值

	if size != "" {
		if strings.Contains(size, ":") {
			config.AspectRatio = size // 直接设置，不与默认值比较
		} else {
			if mapping, exists := getSizeMappings()[size]; exists {
				if mapping.AspectRatio != "" {
					config.AspectRatio = mapping.AspectRatio
				}
				if mapping.ImageSize != "" {
					config.ImageSize = mapping.ImageSize
				}
			}
		}
	}

	if quality != "" {
		qualityMapping := getImageSizeMapping()
		switch strings.ToLower(strings.TrimSpace(quality)) {
		case "hd", "high":
			config.ImageSize = qualityMapping.HD
		case "4k":
			config.ImageSize = qualityMapping.FourK
		case "standard", "medium", "low", "auto", "1k":
			config.ImageSize = qualityMapping.Standard
		}
	}

	return config
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) {
		var content any
		if base64Data, err := relaycommon.GetImageBase64sFromForm(c); err == nil {
			content = []any{
				dto.MediaContent{
					Type: dto.ContentTypeText,
					Text: request.Prompt,
				},
				dto.MediaContent{
					Type: dto.ContentTypeFile,
					File: &dto.MessageFile{
						FileData: base64Data.String(),
					},
				},
			}
		} else {
			content = request.Prompt
		}

		chatRequest := dto.GeneralOpenAIRequest{
			Model: request.Model,
			Messages: []dto.Message{
				{Role: "user", Content: content},
			},
			N: int(request.N),
		}

		config := processSizeParameters(strings.TrimSpace(request.Size), request.Quality)
		googleGenerationConfig := map[string]interface{}{
			"responseModalities": []string{"TEXT", "IMAGE"},
			"imageConfig":        config,
		}

		extraBody := map[string]interface{}{
			"google": map[string]interface{}{
				"generationConfig": googleGenerationConfig,
			},
		}
		chatRequest.ExtraBody, _ = json.Marshal(extraBody)

		return a.ConvertOpenAIRequest(c, info, &chatRequest)
	}

	// convert size to aspect ratio but allow user to specify aspect ratio
	aspectRatio := "1:1" // default aspect ratio
	size := strings.TrimSpace(request.Size)
	if size != "" {
		if strings.Contains(size, ":") {
			aspectRatio = size
		} else {
			if mapping, exists := getSizeMappings()[size]; exists && mapping.AspectRatio != "" {
				aspectRatio = mapping.AspectRatio
			}
		}
	}

	// build gemini imagen request
	geminiRequest := dto.GeminiImageRequest{
		Instances: []dto.GeminiImageInstance{
			{
				Prompt: request.Prompt,
			},
		},
		Parameters: dto.GeminiImageParameters{
			SampleCount:      int(request.N),
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
			if request.Dimensions > 0 {
				geminiRequest["outputDimensionality"] = request.Dimensions
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

	if model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) {
		return ChatImageHandler(c, info, resp)
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
