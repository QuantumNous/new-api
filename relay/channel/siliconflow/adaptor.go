package siliconflow

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

type Adaptor struct {
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ClaudeRequest) (any, error) {
	adaptor := openai.Adaptor{}
	return adaptor.ConvertClaudeRequest(c, info, req)
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	adaptor := openai.Adaptor{}
	return adaptor.ConvertAudioRequest(c, info, request)
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	// 解析extra到SFImageRequest里，以填入SiliconFlow特殊字段。若失败重建一个空的。
	sfRequest := &SFImageRequest{}
	if len(request.ExtraBody) > 0 {
		if err := common.Unmarshal(request.ExtraBody, sfRequest); err != nil {
			return nil, fmt.Errorf("invalid extra_body field: %w", err)
		}
	}
	if len(request.Extra) > 0 {
		extra, err := common.Marshal(request.Extra)
		if err != nil {
			return nil, fmt.Errorf("invalid extra fields: %w", err)
		}
		if err = common.Unmarshal(extra, sfRequest); err != nil {
			return nil, fmt.Errorf("invalid extra fields: %w", err)
		}
	}

	sfRequest.Model = request.Model
	sfRequest.Prompt = request.Prompt
	// 优先使用image_size/batch_size，否则使用OpenAI标准的size/n
	if sfRequest.ImageSize == "" && siliconflowSupportsImageSize(request.Model) {
		sfRequest.ImageSize = siliconflowImageSize(request.Model, request.Size)
	}
	if sfRequest.BatchSize == nil {
		if request.N != nil {
			sfRequest.BatchSize = lo.ToPtr(lo.FromPtr(request.N))
		}
	}
	if sfRequest.OutputFormat == "" && len(request.OutputFormat) > 0 {
		var outputFormat string
		if err := common.Unmarshal(request.OutputFormat, &outputFormat); err != nil {
			return nil, fmt.Errorf("invalid output_format field: %w", err)
		}
		sfRequest.OutputFormat = outputFormat
	}
	if err := applySiliconFlowImageInputs(c, request, sfRequest); err != nil {
		return nil, err
	}

	return sfRequest, nil
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.RelayMode == constant.RelayModeRerank {
		return fmt.Sprintf("%s/v1/rerank", info.ChannelBaseUrl), nil
	}
	if info.RelayMode == constant.RelayModeImagesGenerations || info.RelayMode == constant.RelayModeImagesEdits {
		return fmt.Sprintf("%s/v1/images/generations", strings.TrimRight(info.ChannelBaseUrl, "/")), nil
	}
	return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, info.RequestURLPath, info.ChannelType), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", fmt.Sprintf("Bearer %s", info.ApiKey))
	if info.RelayMode == constant.RelayModeImagesGenerations || info.RelayMode == constant.RelayModeImagesEdits {
		req.Set("Content-Type", "application/json")
	}
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	// SiliconFlow requires messages array for FIM requests, even if client doesn't send it
	if (request.Prefix != nil || request.Suffix != nil) && len(request.Messages) == 0 {
		// Add an empty user message to satisfy SiliconFlow's requirement
		request.Messages = []dto.Message{
			{
				Role:    "user",
				Content: "",
			},
		}
	}
	return request, nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	// TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	if info.RelayMode == constant.RelayModeImagesGenerations || info.RelayMode == constant.RelayModeImagesEdits {
		return channel.DoApiRequest(a, c, info, requestBody)
	}
	adaptor := openai.Adaptor{}
	return adaptor.DoRequest(c, info, requestBody)
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayMode {
	case constant.RelayModeRerank:
		usage, err = siliconflowRerankHandler(c, info, resp)
	case constant.RelayModeImagesGenerations, constant.RelayModeImagesEdits:
		usage, err = siliconflowImageHandler(c, info, resp)
	default:
		adaptor := openai.Adaptor{}
		usage, err = adaptor.DoResponse(c, resp, info)
	}
	return
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

func siliconflowSupportsImageSize(modelName string) bool {
	modelName = strings.TrimSpace(modelName)
	return !strings.EqualFold(modelName, "Qwen/Qwen-Image-Edit") &&
		!strings.EqualFold(modelName, "Qwen/Qwen-Image-Edit-2509")
}

func siliconflowImageSize(modelName string, size string) string {
	size = strings.TrimSpace(size)
	if strings.EqualFold(strings.TrimSpace(modelName), "Qwen/Qwen-Image") {
		switch size {
		case "", "256x256", "512x512", "1024x1024":
			return "1328x1328"
		case "1792x1024":
			return "1664x928"
		case "1024x1792":
			return "928x1664"
		case "1536x1024":
			return "1584x1056"
		case "1024x1536":
			return "1056x1584"
		default:
			return size
		}
	}
	if size == "" {
		return "1024x1024"
	}
	return size
}

func applySiliconFlowImageInputs(c *gin.Context, request dto.ImageRequest, sfRequest *SFImageRequest) error {
	var imageValues []string
	if values, err := parseSiliconFlowImageValues(request.Image); err != nil {
		return fmt.Errorf("invalid image field: %w", err)
	} else {
		imageValues = append(imageValues, values...)
	}
	if values, err := parseSiliconFlowImageValues(request.Images); err != nil {
		return fmt.Errorf("invalid images field: %w", err)
	} else {
		imageValues = append(imageValues, values...)
	}
	if values, err := siliconflowMultipartImageValues(c); err != nil {
		return err
	} else {
		imageValues = append(imageValues, values...)
	}
	return setSiliconFlowImages(sfRequest, imageValues)
}

func parseSiliconFlowImageValues(raw json.RawMessage) ([]string, error) {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" || trimmed == "null" {
		return nil, nil
	}

	var imageValue string
	if err := common.Unmarshal(raw, &imageValue); err == nil {
		imageValue = strings.TrimSpace(imageValue)
		if imageValue == "" {
			return nil, nil
		}
		return []string{imageValue}, nil
	}

	var images []json.RawMessage
	if err := common.Unmarshal(raw, &images); err == nil {
		values := make([]string, 0, len(images))
		for _, item := range images {
			itemValues, itemErr := parseSiliconFlowImageValues(item)
			if itemErr != nil {
				return nil, itemErr
			}
			values = append(values, itemValues...)
		}
		return values, nil
	}

	var object map[string]json.RawMessage
	if err := common.Unmarshal(raw, &object); err != nil {
		return nil, err
	}
	for _, key := range []string{"url", "image", "image_url"} {
		if len(object[key]) == 0 {
			continue
		}
		if key != "image_url" {
			return parseSiliconFlowImageValues(object[key])
		}
		values, err := parseSiliconFlowImageValues(object[key])
		if err == nil && len(values) > 0 {
			return values, nil
		}
		var imageURLObject map[string]json.RawMessage
		if err := common.Unmarshal(object[key], &imageURLObject); err != nil {
			return nil, err
		}
		return parseSiliconFlowImageValues(imageURLObject["url"])
	}
	return nil, nil
}

func siliconflowMultipartImageValues(c *gin.Context) ([]string, error) {
	if c == nil || c.Request == nil || !strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
		return nil, nil
	}
	form, err := common.ParseMultipartFormReusable(c)
	if err != nil {
		return nil, fmt.Errorf("failed to parse image edit form request: %w", err)
	}

	var files []string
	if _, ok := form.File["image"]; ok {
		files = append(files, "image")
	}
	if _, ok := form.File["image[]"]; ok {
		files = append(files, "image[]")
	}
	var indexedKeys []string
	for key := range form.File {
		if strings.HasPrefix(key, "image[") && key != "image[]" {
			indexedKeys = append(indexedKeys, key)
		}
	}
	sort.Strings(indexedKeys)
	files = append(files, indexedKeys...)

	var values []string
	for _, key := range files {
		for _, fileHeader := range form.File[key] {
			file, err := fileHeader.Open()
			if err != nil {
				return nil, fmt.Errorf("failed to open image file: %w", err)
			}
			imageData, readErr := io.ReadAll(file)
			_ = file.Close()
			if readErr != nil {
				return nil, fmt.Errorf("failed to read image file: %w", readErr)
			}

			mimeType := strings.TrimSpace(fileHeader.Header.Get("Content-Type"))
			if mimeType == "" || mimeType == "application/octet-stream" {
				mimeType = http.DetectContentType(imageData)
			}
			values = append(values, fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(imageData)))
		}
	}
	return values, nil
}

func setSiliconFlowImages(sfRequest *SFImageRequest, imageValues []string) error {
	fields := []*string{&sfRequest.Image, &sfRequest.Image2, &sfRequest.Image3}
	for _, imageValue := range imageValues {
		imageValue = strings.TrimSpace(imageValue)
		if imageValue == "" {
			continue
		}
		assigned := false
		for _, field := range fields {
			if *field == "" {
				*field = imageValue
				assigned = true
				break
			}
		}
		if !assigned {
			return errors.New("SiliconFlow image models support at most 3 input images")
		}
	}
	return nil
}
