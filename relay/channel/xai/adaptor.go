package xai

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	neturl "net/url"
	"path"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

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
	if info != nil && info.RelayMode == constant.RelayModeImagesEdits {
		return buildImageEditJSONRequest(request)
	}

	xaiRequest := ImageRequest{
		Model:          request.Model,
		Prompt:         request.Prompt,
		N:              int(lo.FromPtrOr(request.N, uint(1))),
		Image:          request.Image,
		Size:           request.Size,
		ResponseFormat: request.ResponseFormat,
	}
	return xaiRequest, nil
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
			request.MaxTokens = lo.ToPtr(uint(0))
		}
		if strings.HasSuffix(request.Model, "-high") {
			request.ReasoningEffort = "high"
			request.Model = strings.TrimSuffix(request.Model, "-high")
		} else if strings.HasSuffix(request.Model, "-low") {
			request.ReasoningEffort = "low"
			request.Model = strings.TrimSuffix(request.Model, "-low")
		}
		info.ReasoningEffort = request.ReasoningEffort
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
		usage, err = openai.OpenaiHandlerWithUsage(c, info, resp)
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

type imagePayload struct {
	URL      string `json:"url"`
	Data     string `json:"data"`
	B64JSON  string `json:"b64_json"`
	Filename string `json:"filename"`
	Name     string `json:"name"`
	MimeType string `json:"mime_type"`
}

func buildImageEditJSONRequest(request dto.ImageRequest) (map[string]any, error) {
	image, err := buildXAIImageEditSource(request.Image)
	if err != nil {
		return nil, err
	}

	payload := map[string]any{
		"model":  request.Model,
		"prompt": request.Prompt,
		"image":  image,
	}
	if request.N != nil && *request.N > 0 {
		payload["n"] = *request.N
	}
	if strings.TrimSpace(request.ResponseFormat) != "" {
		payload["response_format"] = request.ResponseFormat
	}
	if strings.TrimSpace(request.AspectRatio) != "" {
		payload["aspect_ratio"] = request.AspectRatio
	}
	return payload, nil
}

func buildXAIImageEditSource(rawImage []byte) (any, error) {
	if len(rawImage) == 0 {
		return nil, errors.New("image is required")
	}

	var rawImages []json.RawMessage
	if err := common.Unmarshal(rawImage, &rawImages); err == nil && len(rawImages) > 0 {
		images := make([]map[string]any, 0, len(rawImages))
		for _, item := range rawImages {
			image, err := buildSingleXAIImageEditSource(item)
			if err != nil {
				return nil, err
			}
			images = append(images, image)
		}
		return images, nil
	}

	return buildSingleXAIImageEditSource(rawImage)
}

func buildSingleXAIImageEditSource(rawImage []byte) (map[string]any, error) {
	if len(rawImage) == 0 {
		return nil, errors.New("image is required")
	}

	var simpleString string
	if err := common.Unmarshal(rawImage, &simpleString); err == nil {
		return map[string]any{
			"url":  normalizeXAIImageEditURL(simpleString, ""),
			"type": "image_url",
		}, nil
	}

	var payload imagePayload
	if err := common.Unmarshal(rawImage, &payload); err == nil {
		source := strings.TrimSpace(payload.URL)
		if source == "" {
			source = strings.TrimSpace(payload.Data)
		}
		if source == "" {
			source = strings.TrimSpace(payload.B64JSON)
		}
		if source == "" {
			return nil, errors.New("image is required")
		}
		return map[string]any{
			"url":  normalizeXAIImageEditURL(source, payload.MimeType),
			"type": "image_url",
		}, nil
	}

	return nil, errors.New("unsupported image payload for xai image edit")
}

func normalizeXAIImageEditURL(source string, preferredMime string) string {
	source = strings.TrimSpace(source)
	if source == "" {
		return ""
	}
	if strings.HasPrefix(source, "http://") || strings.HasPrefix(source, "https://") || strings.HasPrefix(source, "data:") {
		return source
	}
	mimeType := strings.TrimSpace(preferredMime)
	if mimeType == "" {
		mimeType = "image/png"
	}
	return fmt.Sprintf("data:%s;base64,%s", mimeType, source)
}

func buildImageEditMultipartRequest(c *gin.Context, request dto.ImageRequest) (*bytes.Buffer, error) {
	var requestBody bytes.Buffer
	writer := multipart.NewWriter(&requestBody)

	writeField := func(key, value string) error {
		if strings.TrimSpace(value) == "" {
			return nil
		}
		return writer.WriteField(key, value)
	}

	if err := writeField("model", request.Model); err != nil {
		return nil, err
	}
	if err := writeField("prompt", request.Prompt); err != nil {
		return nil, err
	}
	if request.N != nil && *request.N > 0 {
		if err := writeField("n", fmt.Sprintf("%d", *request.N)); err != nil {
			return nil, err
		}
	}
	if err := writeField("size", request.Size); err != nil {
		return nil, err
	}
	if err := writeField("response_format", request.ResponseFormat); err != nil {
		return nil, err
	}
	if err := writeField("quality", request.Quality); err != nil {
		return nil, err
	}

	hasImage, err := copyMultipartImageFromRequest(writer, c)
	if err != nil {
		return nil, err
	}
	if !hasImage {
		if err := appendImageFromPayload(writer, request.Image); err != nil {
			return nil, err
		}
	}

	if err := writer.Close(); err != nil {
		return nil, err
	}
	if c != nil && c.Request != nil {
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	}
	return &requestBody, nil
}

func copyMultipartImageFromRequest(writer *multipart.Writer, c *gin.Context) (bool, error) {
	if c == nil || c.Request == nil || !strings.Contains(c.GetHeader("Content-Type"), "multipart/form-data") {
		return false, nil
	}

	formData, err := common.ParseMultipartFormReusable(c)
	if err != nil {
		return false, fmt.Errorf("failed to parse multipart edit form: %w", err)
	}

	fileHeaders := make([]*multipart.FileHeader, 0)
	for key, files := range formData.File {
		if key == "image" || key == "image[]" || strings.HasPrefix(key, "image[") {
			fileHeaders = append(fileHeaders, files...)
		}
	}
	if len(fileHeaders) == 0 {
		return false, nil
	}

	fileHeader := fileHeaders[0]
	file, err := fileHeader.Open()
	if err != nil {
		return false, fmt.Errorf("failed to open edit image: %w", err)
	}
	defer file.Close()

	part, err := createImageFormPart(writer, "image", fileHeader.Filename, detectImageMimeType(fileHeader.Filename))
	if err != nil {
		return false, err
	}
	if _, err = io.Copy(part, file); err != nil {
		return false, fmt.Errorf("failed to copy edit image: %w", err)
	}
	return true, nil
}

func appendImageFromPayload(writer *multipart.Writer, rawImage []byte) error {
	if len(rawImage) == 0 {
		return errors.New("image is required")
	}

	filename, mimeType, content, err := resolveImagePayload(rawImage)
	if err != nil {
		return err
	}

	part, err := createImageFormPart(writer, "image", filename, mimeType)
	if err != nil {
		return err
	}
	if _, err = part.Write(content); err != nil {
		return fmt.Errorf("failed to write edit image: %w", err)
	}
	return nil
}

func resolveImagePayload(rawImage []byte) (string, string, []byte, error) {
	imageValue := strings.TrimSpace(string(rawImage))
	if imageValue == "" || imageValue == "null" {
		return "", "", nil, errors.New("image is required")
	}

	var simpleString string
	if err := common.Unmarshal(rawImage, &simpleString); err == nil {
		return resolveImageSource(simpleString, "", "")
	}

	var payload imagePayload
	if err := common.Unmarshal(rawImage, &payload); err == nil {
		if payload.URL != "" {
			return resolveImageSource(payload.URL, payload.FilenameOrName(), payload.MimeType)
		}
		if payload.Data != "" {
			return resolveImageSource(payload.Data, payload.FilenameOrName(), payload.MimeType)
		}
		if payload.B64JSON != "" {
			return resolveImageSource(payload.B64JSON, payload.FilenameOrName(), payload.MimeType)
		}
	}

	return "", "", nil, errors.New("unsupported image payload for xai image edit")
}

func (p imagePayload) FilenameOrName() string {
	if strings.TrimSpace(p.Filename) != "" {
		return strings.TrimSpace(p.Filename)
	}
	if strings.TrimSpace(p.Name) != "" {
		return strings.TrimSpace(p.Name)
	}
	return ""
}

func resolveImageSource(source string, preferredFilename string, preferredMime string) (string, string, []byte, error) {
	source = strings.TrimSpace(source)
	if source == "" {
		return "", "", nil, errors.New("image is required")
	}

	if strings.HasPrefix(source, "data:") {
		return decodeDataURL(source, preferredFilename)
	}

	if strings.HasPrefix(source, "http://") || strings.HasPrefix(source, "https://") {
		filename, mimeType, content, err := downloadRemoteImage(source)
		if err != nil {
			return "", "", nil, err
		}
		if preferredFilename != "" {
			filename = preferredFilename
		}
		if preferredMime != "" {
			mimeType = preferredMime
		}
		return ensureImageFilename(filename, mimeType), mimeType, content, nil
	}

	decoded, err := base64.StdEncoding.DecodeString(source)
	if err != nil {
		return "", "", nil, fmt.Errorf("unsupported image source for xai image edit: %w", err)
	}
	mimeType := preferredMime
	if mimeType == "" {
		mimeType = "image/png"
	}
	return ensureImageFilename(preferredFilename, mimeType), mimeType, decoded, nil
}

func downloadRemoteImage(source string) (string, string, []byte, error) {
	resp, err := service.DoDownloadRequest(source, "xai image edit source")
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to download edit image: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return "", "", nil, fmt.Errorf("failed to download edit image: status %d", resp.StatusCode)
	}

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to read downloaded edit image: %w", err)
	}

	mimeType := detectMimeFromHeader(resp.Header.Get("Content-Type"))
	filename := filenameFromURL(source)
	return ensureImageFilename(filename, mimeType), mimeType, content, nil
}

func decodeDataURL(source string, preferredFilename string) (string, string, []byte, error) {
	parts := strings.SplitN(source, ",", 2)
	if len(parts) != 2 {
		return "", "", nil, errors.New("invalid image data url")
	}

	header := parts[0]
	payload := parts[1]
	if !strings.HasSuffix(header, ";base64") {
		return "", "", nil, errors.New("image data url must be base64 encoded")
	}

	mediaType := strings.TrimPrefix(strings.TrimSuffix(header, ";base64"), "data:")
	mimeType := mediaType
	if mimeType == "" {
		mimeType = "image/png"
	}

	content, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to decode image data url: %w", err)
	}
	return ensureImageFilename(preferredFilename, mimeType), mimeType, content, nil
}

func createImageFormPart(writer *multipart.Writer, fieldName string, filename string, mimeType string) (io.Writer, error) {
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, filename))
	header.Set("Content-Type", mimeType)
	part, err := writer.CreatePart(header)
	if err != nil {
		return nil, fmt.Errorf("failed to create image form part: %w", err)
	}
	return part, nil
}

func detectImageMimeType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	default:
		return "image/png"
	}
}

func detectMimeFromHeader(contentType string) string {
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil || mediaType == "" {
		return "image/png"
	}
	return mediaType
}

func filenameFromURL(source string) string {
	parsed, err := neturl.Parse(source)
	if err != nil {
		return ""
	}
	filename := path.Base(parsed.Path)
	if filename == "." || filename == "/" {
		return ""
	}
	return filename
}

func ensureImageFilename(filename string, mimeType string) string {
	filename = strings.TrimSpace(filename)
	if filename != "" && filepath.Ext(filename) != "" {
		return filename
	}

	exts, err := mime.ExtensionsByType(mimeType)
	if err == nil && len(exts) > 0 {
		ext := exts[0]
		if filename == "" {
			return "image" + ext
		}
		return filename + ext
	}

	if filename == "" {
		return "image.png"
	}
	return filename + ".png"
}
