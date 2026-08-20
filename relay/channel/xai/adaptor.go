package xai

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

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
	xaiRequest := ImageRequest{
		Model:          request.Model,
		Prompt:         request.Prompt,
		N:              int(lo.FromPtrOr(request.N, uint(1))),
		ResponseFormat: request.ResponseFormat,
	}
	if aspectRatio, ok := request.Extra["aspect_ratio"]; ok {
		if err := common.Unmarshal(aspectRatio, &xaiRequest.AspectRatio); err != nil {
			return nil, fmt.Errorf("invalid xAI aspect_ratio: %w", err)
		}
	}

	if info.RelayMode != constant.RelayModeImagesEdits {
		return xaiRequest, nil
	}

	if len(request.Mask) > 0 {
		return nil, errors.New("xAI image edits do not support mask")
	}

	var images []ImageInput
	if strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
		xaiRequest.AspectRatio = c.PostForm("aspect_ratio")
		var err error
		images, err = imageInputsFromMultipartForm(c)
		if err != nil {
			return nil, err
		}
	}
	if len(images) == 0 {
		var err error
		images, err = imageInputsFromRequest(request)
		if err != nil {
			return nil, err
		}
	}
	if len(images) == 0 {
		return nil, errors.New("xAI image edits require at least one image")
	}

	if len(images) == 1 {
		xaiRequest.Image = &images[0]
	} else {
		xaiRequest.Images = images
	}
	// xAI image edits accepts JSON even when the OpenAI-compatible client used multipart.
	c.Request.Header.Set("Content-Type", "application/json")
	return xaiRequest, nil
}

func imageInputsFromRequest(request dto.ImageRequest) ([]ImageInput, error) {
	if len(request.Image) > 0 && len(request.Images) > 0 {
		return nil, errors.New("xAI image edits accept image or images, not both")
	}
	if len(request.Image) > 0 {
		image, err := parseImageInput(request.Image)
		if err != nil {
			return nil, fmt.Errorf("invalid xAI image: %w", err)
		}
		return []ImageInput{image}, nil
	}
	if len(request.Images) == 0 {
		return nil, nil
	}

	var images []ImageInput
	if err := common.Unmarshal(request.Images, &images); err != nil {
		return nil, fmt.Errorf("invalid xAI images: %w", err)
	}
	for _, image := range images {
		if err := validateImageInput(image); err != nil {
			return nil, err
		}
	}
	return images, nil
}

func parseImageInput(raw []byte) (ImageInput, error) {
	var image ImageInput
	if err := common.Unmarshal(raw, &image); err == nil {
		if err := validateImageInput(image); err == nil {
			return image, nil
		}
	}

	var imageURL string
	if err := common.Unmarshal(raw, &imageURL); err != nil {
		return ImageInput{}, errors.New("must be an image_url object or URL string")
	}
	image = ImageInput{Type: dto.ContentTypeImageURL, URL: imageURL}
	if err := validateImageInput(image); err != nil {
		return ImageInput{}, err
	}
	return image, nil
}

func validateImageInput(image ImageInput) error {
	if image.Type != dto.ContentTypeImageURL || strings.TrimSpace(image.URL) == "" {
		return errors.New("must contain type image_url and a non-empty url")
	}
	return nil
}

func imageInputsFromMultipartForm(c *gin.Context) ([]ImageInput, error) {
	form := c.Request.MultipartForm
	if form == nil {
		var err error
		form, err = common.ParseMultipartFormReusable(c)
		if err != nil {
			return nil, fmt.Errorf("failed to parse xAI image edit form: %w", err)
		}
		c.Request.MultipartForm = form
	}
	if len(form.File["mask"]) > 0 || len(form.Value["mask"]) > 0 {
		return nil, errors.New("xAI image edits do not support mask")
	}

	files := append([]*multipart.FileHeader{}, form.File["image"]...)
	files = append(files, form.File["image[]"]...)
	var indexedFields []string
	for field := range form.File {
		if strings.HasPrefix(field, "image[") && field != "image[]" {
			indexedFields = append(indexedFields, field)
		}
	}
	sort.Strings(indexedFields)
	for _, field := range indexedFields {
		files = append(files, form.File[field]...)
	}

	images := make([]ImageInput, 0, len(files))
	for _, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			return nil, fmt.Errorf("failed to open xAI image file: %w", err)
		}
		data, readErr := io.ReadAll(file)
		closeErr := file.Close()
		if readErr != nil {
			return nil, fmt.Errorf("failed to read xAI image file: %w", readErr)
		}
		if closeErr != nil {
			return nil, fmt.Errorf("failed to close xAI image file: %w", closeErr)
		}
		images = append(images, ImageInput{
			Type: dto.ContentTypeImageURL,
			URL:  fmt.Sprintf("data:%s;base64,%s", http.DetectContentType(data), base64.StdEncoding.EncodeToString(data)),
		})
	}
	return images, nil
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, info.RequestURLPath, info.ChannelType), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
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
		if strings.HasSuffix(request.Model, "-high") {
			request.ReasoningEffort = "high"
			request.Model = strings.TrimSuffix(request.Model, "-high")
		} else if strings.HasSuffix(request.Model, "-low") {
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
