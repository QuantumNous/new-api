package xai

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"path/filepath"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/QuantumNous/new-api/relay/constant"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

type Adaptor struct {
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	//TODO implement me
	//panic("implement me")
	return nil, errors.New("not available")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	//not available
	return nil, errors.New("not available")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if err := request.ValidateXAIImageRequest(); err != nil {
		return nil, err
	}
	xaiRequest := ImageRequest{
		Model:          request.Model,
		Prompt:         request.Prompt,
		N:              int(lo.FromPtrOr(request.N, uint(1))),
		AspectRatio:    request.AspectRatio,
		Resolution:     request.Resolution,
		Quality:        request.Quality,
		ResponseFormat: request.ResponseFormat,
	}
	if info.RelayMode == constant.RelayModeImagesEdits {
		images, err := xAIEditImages(c, request)
		if err != nil {
			return nil, err
		}
		if len(images) == 1 {
			xaiRequest.Image = images[0]
		} else {
			xaiRequest.Images = images
		}
	}
	return xaiRequest, nil
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	if info.RelayMode == constant.RelayModeResponses {
		info.VendorToolUsage = xaiResponsesToolUsage
	}
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, info.RequestURLPath, info.ChannelType), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	if info.RelayMode == constant.RelayModeImagesGenerations || info.RelayMode == constant.RelayModeImagesEdits {
		req.Set("Content-Type", "application/json")
	}
	req.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func xAIEditImages(c *gin.Context, request dto.ImageRequest) ([]json.RawMessage, error) {
	if strings.HasPrefix(strings.ToLower(c.Request.Header.Get("Content-Type")), "multipart/form-data") {
		form := c.Request.MultipartForm
		if form == nil {
			parsed, err := common.ParseMultipartFormReusable(c)
			if err != nil {
				return nil, fmt.Errorf("failed to parse multipart form: %w", err)
			}
			c.Request.MultipartForm = parsed
			c.Request.PostForm = url.Values(parsed.Value)
			form = parsed
		}
		var imageFiles []*multipart.FileHeader
		for _, field := range []string{"image", "image[]"} {
			imageFiles = append(imageFiles, form.File[field]...)
		}
		fieldNames := make([]string, 0)
		for field := range form.File {
			if strings.HasPrefix(field, "image[") && field != "image[]" {
				fieldNames = append(fieldNames, field)
			}
		}
		slices.Sort(fieldNames)
		for _, field := range fieldNames {
			imageFiles = append(imageFiles, form.File[field]...)
		}
		if len(imageFiles) > dto.MaxXAIInputImages {
			return nil, fmt.Errorf("xAI image edits support at most %d input images", dto.MaxXAIInputImages)
		}
		images := make([]json.RawMessage, 0, len(imageFiles))
		for _, fileHeader := range imageFiles {
			file, err := fileHeader.Open()
			if err != nil {
				return nil, fmt.Errorf("failed to open image %q: %w", fileHeader.Filename, err)
			}
			data, readErr := io.ReadAll(file)
			_ = file.Close()
			if readErr != nil {
				return nil, fmt.Errorf("failed to read image %q: %w", fileHeader.Filename, readErr)
			}
			contentType := fileHeader.Header.Get("Content-Type")
			if contentType == "" || contentType == "application/octet-stream" {
				if extensionType := mime.TypeByExtension(filepath.Ext(fileHeader.Filename)); extensionType != "" {
					contentType = extensionType
				}
			}
			if contentType == "" {
				contentType = "application/octet-stream"
			}
			url := "data:" + contentType + ";base64," + base64.StdEncoding.EncodeToString(data)
			encoded, err := common.Marshal(map[string]string{"url": url})
			if err != nil {
				return nil, err
			}
			images = append(images, encoded)
		}
		if len(images) > 0 {
			return images, nil
		}
	}

	if len(request.Images) > 0 && string(request.Images) != "null" {
		var images []json.RawMessage
		if err := common.Unmarshal(request.Images, &images); err != nil {
			return nil, fmt.Errorf("invalid xAI images: %w", err)
		}
		if len(images) == 0 || len(images) > dto.MaxXAIInputImages {
			return nil, fmt.Errorf("xAI image edits require 1 to %d input images", dto.MaxXAIInputImages)
		}
		normalized := make([]json.RawMessage, 0, len(images))
		for _, image := range images {
			normalizedImage, err := normalizeXAIImage(image)
			if err != nil {
				return nil, err
			}
			normalized = append(normalized, normalizedImage)
		}
		return normalized, nil
	}
	if len(request.Image) > 0 && string(request.Image) != "null" {
		image, err := normalizeXAIImage(request.Image)
		if err != nil {
			return nil, err
		}
		return []json.RawMessage{image}, nil
	}
	return nil, errors.New("image is required for xAI image edits")
}

func normalizeXAIImage(raw json.RawMessage) (json.RawMessage, error) {
	var value any
	if err := common.Unmarshal(raw, &value); err != nil {
		return nil, fmt.Errorf("invalid xAI image: %w", err)
	}
	if text, ok := value.(string); ok {
		encoded, err := common.Marshal(map[string]string{"url": text})
		if err != nil {
			return nil, err
		}
		return encoded, nil
	}
	if _, ok := value.(map[string]any); !ok {
		return nil, errors.New("xAI image must be an object or URL string")
	}
	return raw, nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	if strings.HasSuffix(info.UpstreamModelName, "-search") {
		info.UpstreamModelName = strings.TrimSuffix(info.UpstreamModelName, "-search")
		request.Model = info.UpstreamModelName
		toMap := request.ToMap()
		toMap["search_parameters"] = map[string]any{
			"mode": "on",
		}
		return toMap, nil
	}
	if strings.HasPrefix(request.Model, "grok-3-mini") {
		if lo.FromPtrOr(request.MaxCompletionTokens, uint(0)) == 0 && lo.FromPtrOr(request.MaxTokens, uint(0)) != 0 {
			request.MaxCompletionTokens = request.MaxTokens
			request.MaxTokens = nil
		}
		preserveSuffix := model_setting.ShouldPreserveThinkingSuffix(info.OriginModelName) || model_setting.ShouldPreserveThinkingSuffix(request.Model)
		if !preserveSuffix && strings.HasSuffix(request.Model, "-high") {
			request.ReasoningEffort = "high"
			request.Model = strings.TrimSuffix(request.Model, "-high")
		} else if !preserveSuffix && strings.HasSuffix(request.Model, "-low") {
			request.ReasoningEffort = "low"
			request.Model = strings.TrimSuffix(request.Model, "-low")
		}
		info.SetReasoningEffort(request.ReasoningEffort)
		info.UpstreamModelName = request.Model
	}
	return request, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	//not available
	return nil, errors.New("not available")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	if request.Model == "" && info != nil {
		request.Model = info.UpstreamModelName
	}
	return request, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayMode {
	case constant.RelayModeImagesGenerations, constant.RelayModeImagesEdits:
		usage, err = openai.OpenaiImageHandler(c, info, resp)
	case constant.RelayModeResponses:
		if info.IsStream {
			usage, err = openai.OaiResponsesStreamHandler(c, info, resp)
		} else {
			usage, err = openai.OaiResponsesHandler(c, info, resp)
		}
	default:
		if info.IsStream {
			usage, err = xAIStreamHandler(c, info, resp)
		} else {
			usage, err = xAIHandler(c, info, resp)
		}
	}
	return
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
