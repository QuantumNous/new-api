package listenhub

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

func convertImageRequest(request dto.ImageRequest) (*ImageRequest, error) {
	modelName := strings.TrimSpace(request.Model)
	if modelName == "" {
		modelName = "gemini-3-pro-image-preview"
	}

	listenHubRequest := &ImageRequest{
		Provider:    providerForModel(modelName),
		Model:       modelName,
		Prompt:      request.Prompt,
		ImageConfig: imageConfigFromOpenAIRequest(request),
	}

	if err := applyImageExtra(listenHubRequest, request.ExtraBody); err != nil {
		return nil, err
	}
	if err := applyImageExtraMap(listenHubRequest, request.Extra); err != nil {
		return nil, err
	}
	if err := appendReferenceImagesFromRaw(&listenHubRequest.ReferenceImages, request.Image); err != nil {
		return nil, fmt.Errorf("invalid image field: %w", err)
	}
	if err := appendReferenceImagesFromRaw(&listenHubRequest.ReferenceImages, request.Images); err != nil {
		return nil, fmt.Errorf("invalid images field: %w", err)
	}

	if listenHubRequest.Provider == "" {
		listenHubRequest.Provider = providerForModel(listenHubRequest.Model)
	}
	if listenHubRequest.Model == "" {
		listenHubRequest.Model = modelName
	}
	return listenHubRequest, nil
}

func providerForModel(modelName string) string {
	if strings.EqualFold(strings.TrimSpace(modelName), "gpt-image-2") {
		return "openai"
	}
	return "google"
}

func imageConfigFromOpenAIRequest(request dto.ImageRequest) *ImageConfig {
	config := &ImageConfig{}

	if aspectRatio := aspectRatioFromImageRequest(request); aspectRatio != "" {
		config.AspectRatio = aspectRatio
	}
	if imageSize := imageSizeFromImageRequest(request); imageSize != "" {
		config.ImageSize = imageSize
	}

	if config.AspectRatio == "" && config.ImageSize == "" {
		return nil
	}
	return config
}

func aspectRatioFromImageRequest(request dto.ImageRequest) string {
	if raw, ok := request.Extra["aspect_ratio"]; ok {
		var aspectRatio string
		if err := common.Unmarshal(raw, &aspectRatio); err == nil && aspectRatio != "" {
			return aspectRatio
		}
	}

	switch strings.TrimSpace(request.Size) {
	case "1024x1024", "512x512", "256x256":
		return "1:1"
	case "1792x1024":
		return "16:9"
	case "1024x1792":
		return "9:16"
	case "1536x1024", "1248x832":
		return "3:2"
	case "1024x1536", "832x1248":
		return "2:3"
	case "1152x864":
		return "4:3"
	case "864x1152":
		return "3:4"
	case "1344x576":
		return "21:9"
	}

	width, height, ok := parseImageSize(request.Size)
	if !ok {
		return ""
	}
	ratio := reduceAspectRatio(width, height)
	switch ratio {
	case "1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9", "1:4", "4:1", "1:8", "8:1":
		return ratio
	default:
		return ""
	}
}

func imageSizeFromImageRequest(request dto.ImageRequest) string {
	if raw, ok := request.Extra["image_size"]; ok {
		var imageSize string
		if err := common.Unmarshal(raw, &imageSize); err == nil && imageSize != "" {
			return imageSize
		}
	}

	switch strings.ToUpper(strings.TrimSpace(request.Quality)) {
	case "1K", "2K", "4K":
		return strings.ToUpper(strings.TrimSpace(request.Quality))
	case "LOW", "STANDARD":
		return "1K"
	case "MEDIUM", "HD", "HIGH":
		return "2K"
	case "ULTRA", "ULTRA_HD":
		return "4K"
	default:
		return ""
	}
}

func applyImageExtra(target *ImageRequest, raw json.RawMessage) error {
	if len(raw) == 0 {
		return nil
	}

	var fields map[string]json.RawMessage
	if err := common.Unmarshal(raw, &fields); err != nil {
		return fmt.Errorf("invalid extra_body field: %w", err)
	}
	if nested := fields["listenhub"]; len(nested) > 0 {
		if err := applyImageExtra(target, nested); err != nil {
			return err
		}
	}
	return applyImageExtraFields(target, fields)
}

func applyImageExtraFields(target *ImageRequest, fields map[string]json.RawMessage) error {
	if err := setStringField(fields, "provider", &target.Provider); err != nil {
		return err
	}
	if err := setStringField(fields, "model", &target.Model); err != nil {
		return err
	}
	for _, key := range []string{"imageConfig", "image_config"} {
		if raw := fields[key]; len(raw) > 0 {
			config, err := parseImageConfig(raw)
			if err != nil {
				return fmt.Errorf("invalid %s field: %w", key, err)
			}
			target.ImageConfig = mergeImageConfig(target.ImageConfig, config)
		}
	}
	for _, key := range []string{"referenceImages", "reference_images"} {
		if err := appendReferenceImagesFromRaw(&target.ReferenceImages, fields[key]); err != nil {
			return fmt.Errorf("invalid %s field: %w", key, err)
		}
	}
	return nil
}

func parseImageConfig(raw json.RawMessage) (*ImageConfig, error) {
	var config struct {
		ImageSize        string `json:"imageSize,omitempty"`
		ImageSizeSnake   string `json:"image_size,omitempty"`
		AspectRatio      string `json:"aspectRatio,omitempty"`
		AspectRatioSnake string `json:"aspect_ratio,omitempty"`
	}
	if err := common.Unmarshal(raw, &config); err != nil {
		return nil, err
	}
	return &ImageConfig{
		ImageSize:   common.GetStringIfEmpty(config.ImageSize, config.ImageSizeSnake),
		AspectRatio: common.GetStringIfEmpty(config.AspectRatio, config.AspectRatioSnake),
	}, nil
}

func setStringField(fields map[string]json.RawMessage, key string, target *string) error {
	raw := fields[key]
	if len(raw) == 0 {
		return nil
	}
	var value string
	if err := common.Unmarshal(raw, &value); err != nil {
		return fmt.Errorf("invalid %s field: %w", key, err)
	}
	if value != "" {
		*target = value
	}
	return nil
}

func applyImageExtraMap(target *ImageRequest, extra map[string]json.RawMessage) error {
	if len(extra) == 0 {
		return nil
	}
	raw, err := common.Marshal(extra)
	if err != nil {
		return err
	}
	if err := applyImageExtra(target, raw); err != nil {
		return err
	}
	return nil
}

func mergeImageConfig(base *ImageConfig, override *ImageConfig) *ImageConfig {
	if override == nil {
		return base
	}
	if base == nil {
		base = &ImageConfig{}
	}
	if override.AspectRatio != "" {
		base.AspectRatio = override.AspectRatio
	}
	if override.ImageSize != "" {
		base.ImageSize = override.ImageSize
	}
	return base
}

func appendReferenceImagesFromRaw(target *[]ReferenceImage, raw json.RawMessage) error {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}

	var direct []ReferenceImage
	if err := common.Unmarshal(raw, &direct); err == nil && len(direct) > 0 && direct[0].hasData() {
		*target = append(*target, direct...)
		return nil
	}

	var one ReferenceImage
	if err := common.Unmarshal(raw, &one); err == nil && one.hasData() {
		*target = append(*target, one)
		return nil
	}

	var values []json.RawMessage
	if err := common.Unmarshal(raw, &values); err == nil {
		for _, value := range values {
			if err := appendReferenceImagesFromRaw(target, value); err != nil {
				return err
			}
		}
		return nil
	}

	var value string
	if err := common.Unmarshal(raw, &value); err == nil {
		ref, err := referenceImageFromString(value)
		if err != nil {
			return err
		}
		*target = append(*target, ref)
		return nil
	}

	var obj map[string]json.RawMessage
	if err := common.Unmarshal(raw, &obj); err != nil {
		return err
	}
	for _, key := range []string{"url", "fileUri", "file_uri"} {
		if rawURL, ok := obj[key]; ok {
			var url string
			if err := common.Unmarshal(rawURL, &url); err != nil {
				return err
			}
			ref, err := referenceImageFromString(url)
			if err != nil {
				return err
			}
			*target = append(*target, ref)
			return nil
		}
	}
	if rawImageURL, ok := obj["image_url"]; ok {
		return appendImageURLReference(target, rawImageURL)
	}
	return nil
}

func appendImageURLReference(target *[]ReferenceImage, raw json.RawMessage) error {
	var url string
	if err := common.Unmarshal(raw, &url); err == nil {
		ref, err := referenceImageFromString(url)
		if err != nil {
			return err
		}
		*target = append(*target, ref)
		return nil
	}

	var obj struct {
		URL string `json:"url"`
	}
	if err := common.Unmarshal(raw, &obj); err != nil {
		return err
	}
	if obj.URL == "" {
		return nil
	}
	ref, err := referenceImageFromString(obj.URL)
	if err != nil {
		return err
	}
	*target = append(*target, ref)
	return nil
}

func referenceImageFromString(value string) (ReferenceImage, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return ReferenceImage{}, errors.New("empty reference image")
	}
	if strings.HasPrefix(value, "data:") {
		mimeType, data, ok := parseDataURI(value)
		if !ok {
			return ReferenceImage{}, errors.New("invalid data URI reference image")
		}
		return ReferenceImage{InlineData: &InlineData{Data: data, MimeType: mimeType}}, nil
	}
	return ReferenceImage{FileData: &FileData{FileURI: value, MimeType: inferImageMimeType(value)}}, nil
}

func parseDataURI(value string) (string, string, bool) {
	commaIdx := strings.Index(value, ",")
	if commaIdx < 0 {
		return "", "", false
	}
	meta := value[len("data:"):commaIdx]
	data := value[commaIdx+1:]
	parts := strings.Split(meta, ";")
	if len(parts) == 0 || parts[0] == "" || data == "" {
		return "", "", false
	}
	return parts[0], data, true
}

func inferImageMimeType(value string) string {
	ext := strings.ToLower(path.Ext(strings.Split(value, "?")[0]))
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".heic":
		return "image/heic"
	case ".heif":
		return "image/heif"
	default:
		return "image/png"
	}
}

func (r ReferenceImage) hasData() bool {
	return r.FileData != nil || r.InlineData != nil
}

func parseImageSize(size string) (int, int, bool) {
	parts := strings.Split(size, "x")
	if len(parts) != 2 {
		return 0, 0, false
	}
	width, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, false
	}
	height, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, 0, false
	}
	if width <= 0 || height <= 0 {
		return 0, 0, false
	}
	return width, height, true
}

func reduceAspectRatio(width, height int) string {
	divisor := gcd(width, height)
	return fmt.Sprintf("%d:%d", width/divisor, height/divisor)
}

func gcd(a, b int) int {
	for b != 0 {
		a, b = b, a%b
	}
	if a == 0 {
		return 1
	}
	return a
}

func imageHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)

	var listenHubResponse ImageResponse
	if err := common.Unmarshal(responseBody, &listenHubResponse); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if listenHubResponse.Error != nil {
		return nil, types.WithOpenAIError(types.OpenAIError{
			Message: listenHubResponse.Error.Message,
			Type:    lo.Ternary(listenHubResponse.Error.Type == "", "listenhub_image_error", listenHubResponse.Error.Type),
			Code:    listenHubResponse.Error.Code,
		}, resp.StatusCode)
	}

	openAIResponse := dto.ImageResponse{
		Created: info.StartTime.Unix(),
	}
	for _, candidate := range listenHubResponse.Candidates {
		for _, part := range candidate.Content.Parts {
			if part.InlineData == nil || part.InlineData.Data == "" {
				continue
			}
			if !strings.HasPrefix(strings.ToLower(part.InlineData.MimeType), "image/") {
				continue
			}
			openAIResponse.Data = append(openAIResponse.Data, dto.ImageData{
				B64Json: part.InlineData.Data,
			})
		}
	}
	if len(openAIResponse.Data) == 0 {
		return nil, types.NewOpenAIError(errors.New("no images generated"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	jsonResponse, err := common.Marshal(openAIResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	if _, err := c.Writer.Write(jsonResponse); err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}

	imageTokens := len(openAIResponse.Data) * 258
	return &dto.Usage{
		PromptTokens:     imageTokens,
		CompletionTokens: 0,
		TotalTokens:      imageTokens,
	}, nil
}
