package minimax

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type MiniMaxImageRequest struct {
	Model           string `json:"model"`
	Prompt          string `json:"prompt"`
	AspectRatio     string `json:"aspect_ratio,omitempty"`
	ResponseFormat  string `json:"response_format,omitempty"`
	N               int    `json:"n,omitempty"`
	PromptOptimizer *bool  `json:"prompt_optimizer,omitempty"`
	AigcWatermark   *bool  `json:"aigc_watermark,omitempty"`
}

type MiniMaxImageResponse struct {
	ID   string `json:"id"`
	Data struct {
		ImageURLs   []string `json:"image_urls"`
		ImageBase64 []string `json:"image_base64"`
	} `json:"data"`
	Metadata map[string]any `json:"metadata"`
	BaseResp struct {
		StatusCode int    `json:"status_code"`
		StatusMsg  string `json:"status_msg"`
	} `json:"base_resp"`
}

func oaiImage2MiniMaxImageRequest(request dto.ImageRequest) MiniMaxImageRequest {
	responseFormat := normalizeMiniMaxResponseFormat(request.ResponseFormat)
	minimaxRequest := MiniMaxImageRequest{
		Model:          request.Model,
		Prompt:         request.Prompt,
		ResponseFormat: responseFormat,
		N:              1,
		AigcWatermark:  request.Watermark,
	}

	if request.Model == "" {
		minimaxRequest.Model = "image-01"
	}
	if request.N != nil && *request.N > 0 {
		minimaxRequest.N = int(*request.N)
	}
	if aspectRatio := aspectRatioFromImageRequest(request); aspectRatio != "" {
		minimaxRequest.AspectRatio = aspectRatio
	}
	if raw, ok := request.Extra["prompt_optimizer"]; ok {
		var promptOptimizer bool
		if err := common.Unmarshal(raw, &promptOptimizer); err == nil {
			minimaxRequest.PromptOptimizer = &promptOptimizer
		}
	}

	return minimaxRequest
}

func aspectRatioFromImageRequest(request dto.ImageRequest) string {
	if raw, ok := request.Extra["aspect_ratio"]; ok {
		var aspectRatio string
		if err := common.Unmarshal(raw, &aspectRatio); err == nil && aspectRatio != "" {
			return aspectRatio
		}
	}

	switch request.Size {
	case "1024x1024":
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
	case "1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9":
		return ratio
	default:
		return ""
	}
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

func normalizeMiniMaxResponseFormat(responseFormat string) string {
	switch strings.ToLower(responseFormat) {
	case "", "url":
		return "url"
	case "b64_json", "base64":
		return "base64"
	default:
		return responseFormat
	}
}

func responseMiniMax2OpenAIImage(response *MiniMaxImageResponse, info *relaycommon.RelayInfo) (*dto.ImageResponse, error) {
	imageResponse := &dto.ImageResponse{
		Created: info.StartTime.Unix(),
	}

	for _, imageURL := range response.Data.ImageURLs {
		imageResponse.Data = append(imageResponse.Data, dto.ImageData{Url: imageURL})
	}
	for _, imageBase64 := range response.Data.ImageBase64 {
		imageResponse.Data = append(imageResponse.Data, dto.ImageData{B64Json: imageBase64})
	}
	if len(response.Metadata) > 0 {
		metadata, err := common.Marshal(response.Metadata)
		if err != nil {
			return nil, err
		}
		imageResponse.Metadata = metadata
	}

	return imageResponse, nil
}

func miniMaxImageHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)

	var minimaxResponse MiniMaxImageResponse
	if err := common.Unmarshal(responseBody, &minimaxResponse); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if minimaxResponse.BaseResp.StatusCode != 0 {
		return nil, types.WithOpenAIError(types.OpenAIError{
			Message: minimaxResponse.BaseResp.StatusMsg,
			Type:    "minimax_image_error",
			Code:    fmt.Sprintf("%d", minimaxResponse.BaseResp.StatusCode),
		}, resp.StatusCode)
	}

	openAIResponse, err := responseMiniMax2OpenAIImage(&minimaxResponse, info)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
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

	return &dto.Usage{}, nil
}

func isLegacyMiniMaxImageModel(model string) bool {
	switch model {
	case "", "image-01", "image-01-live":
		return true
	default:
		return false
	}
}

func relayImageModel(info *relaycommon.RelayInfo) string {
	if info == nil {
		return ""
	}
	if info.ChannelMeta != nil && info.UpstreamModelName != "" {
		return info.UpstreamModelName
	}
	return info.OriginModelName
}

func imageModelName(info *relaycommon.RelayInfo, request dto.ImageRequest) string {
	if request.Model != "" {
		return request.Model
	}
	return relayImageModel(info)
}

func convertOpenAICompatibleImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	switch info.RelayMode {
	case constant.RelayModeImagesGenerations, constant.RelayModeImagesEdits:
	default:
		return nil, fmt.Errorf("unsupported image relay mode: %d", info.RelayMode)
	}
	if info.RelayMode == constant.RelayModeImagesEdits && isMultipartImageRequest(c) {
		c.Request.Header.Set("Content-Type", "application/json")
		return convertH3MultipartEditRequest(c, request)
	}
	return passthroughOpenAIImageRequest(request)
}

func isMultipartImageRequest(c *gin.Context) bool {
	if c == nil || c.Request == nil {
		return false
	}
	return strings.HasPrefix(c.Request.Header.Get("Content-Type"), "multipart/form-data")
}

func passthroughOpenAIImageRequest(request dto.ImageRequest) (map[string]any, error) {
	payload, err := imageRequestPayload(request)
	if err != nil {
		return nil, err
	}
	normalizeH3EditImages(payload)
	return payload, nil
}

func imageRequestPayload(request dto.ImageRequest) (map[string]any, error) {
	body, err := common.Marshal(request)
	if err != nil {
		return nil, err
	}
	var payload map[string]any
	if err := common.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	for k, raw := range request.Extra {
		var v any
		if err := common.Unmarshal(raw, &v); err != nil {
			continue
		}
		payload[k] = v
	}
	return payload, nil
}

func normalizeH3EditImages(payload map[string]any) {
	if images, ok := payload["images"]; ok {
		if refs := h3ImageRefs(images); len(refs) > 0 {
			payload["images"] = refs
		}
		return
	}
	if image, ok := payload["image"]; ok {
		if refs := h3ImageRefs(image); len(refs) > 0 {
			payload["images"] = refs
			delete(payload, "image")
		}
	}
}

func h3ImageRefs(v any) []map[string]string {
	switch x := v.(type) {
	case string:
		if x == "" {
			return nil
		}
		return []map[string]string{{"image_url": x}}
	case []any:
		var refs []map[string]string
		for _, item := range x {
			refs = append(refs, h3ImageRefs(item)...)
		}
		return refs
	case map[string]any:
		if url, ok := x["image_url"].(string); ok && url != "" {
			return []map[string]string{{"image_url": url}}
		}
		if url, ok := x["url"].(string); ok && url != "" {
			return []map[string]string{{"image_url": url}}
		}
		return nil
	default:
		return nil
	}
}

func convertH3MultipartEditRequest(c *gin.Context, request dto.ImageRequest) (any, error) {
	payload, err := imageRequestPayload(request)
	if err != nil {
		return nil, err
	}
	form, err := common.ParseMultipartFormReusable(c)
	if err != nil {
		return nil, err
	}
	var refs []map[string]string
	appendFiles := func(files []*multipart.FileHeader) error {
		for _, fh := range files {
			ref, err := h3DataURIFromFile(fh)
			if err != nil {
				return err
			}
			refs = append(refs, map[string]string{"image_url": ref})
		}
		return nil
	}
	if form != nil && form.File != nil {
		if err := appendFiles(form.File["image"]); err != nil {
			return nil, err
		}
		if err := appendFiles(form.File["image[]"]); err != nil {
			return nil, err
		}
		for name, files := range form.File {
			if strings.HasPrefix(name, "image[") && name != "image[]" {
				if err := appendFiles(files); err != nil {
					return nil, err
				}
			}
		}
	}
	if form != nil {
		for _, value := range form.Value["image"] {
			refs = append(refs, h3ImageRefs(value)...)
		}
	}
	if len(refs) > 0 {
		payload["images"] = refs
		delete(payload, "image")
	} else {
		normalizeH3EditImages(payload)
	}
	return payload, nil
}

func h3DataURIFromFile(fh *multipart.FileHeader) (string, error) {
	file, err := fh.Open()
	if err != nil {
		return "", err
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		return "", err
	}
	mimeType := fh.Header.Get("Content-Type")
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = h3ImageMIMEType(fh.Filename)
	}
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}

func h3ImageMIMEType(filename string) string {
	switch strings.ToLower(filepath.Ext(filename)) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	default:
		return "image/png"
	}
}

func miniMaxOpenAIImageHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)

	var probe struct {
		BaseResp struct {
			StatusCode int    `json:"status_code"`
			StatusMsg  string `json:"status_msg"`
		} `json:"base_resp"`
	}
	if err := common.Unmarshal(body, &probe); err == nil && probe.BaseResp.StatusCode != 0 {
		return nil, types.WithOpenAIError(types.OpenAIError{
			Message: probe.BaseResp.StatusMsg,
			Type:    "minimax_image_error",
			Code:    fmt.Sprintf("%d", probe.BaseResp.StatusCode),
		}, resp.StatusCode)
	}

	resp.Body = io.NopCloser(bytes.NewReader(body))
	return openai.OpenaiImageHandler(c, info, resp)
}
