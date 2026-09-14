package huawei

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// maxEditImages is the per-request image limit for MaaS image editing
// (https://support.huaweicloud.com/model-call-maas/model-call-023.html).
const maxEditImages = 2

// convertGenerationRequest maps an OpenAI-format image generation request to
// the Huawei MaaS shape. MaaS does not document the n parameter and returns a
// single image per call, so n > 1 is rejected before it can become a billing
// multiplier; n is also bounded by dto.MaxImageN as everywhere else.
func convertGenerationRequest(request dto.ImageRequest) (*MaaSImageRequest, error) {
	if request.Stream != nil && *request.Stream {
		return nil, types.NewErrorWithStatusCode(errors.New("huawei MaaS image generation does not support streaming"), types.ErrorCodeInvalidRequest, http.StatusBadRequest)
	}
	if err := validateImageN(request.N); err != nil {
		return nil, err
	}
	if err := validateResponseFormat(request.ResponseFormat); err != nil {
		return nil, err
	}

	imageRequest := MaaSImageRequest{
		Model:     request.Model,
		Prompt:    request.Prompt,
		Size:      request.Size,
		Watermark: request.Watermark,
	}
	// MaaS only accepts response_format=b64_json; omit the field otherwise so
	// the upstream never sees an unsupported value.
	if request.ResponseFormat == "b64_json" {
		imageRequest.ResponseFormat = request.ResponseFormat
	}
	if err := applySeed(request, &imageRequest); err != nil {
		return nil, err
	}
	return &imageRequest, nil
}

// convertEditRequest builds the MaaS edit request. Multipart clients provide
// the image(s) as uploaded files; JSON clients pass an image data URL or URL
// (or a comma-joined list) in the top-level image field. MaaS edits return a
// single image and accept at most maxEditImages input images.
func convertEditRequest(c *gin.Context, request dto.ImageRequest) (*MaaSImageRequest, error) {
	if err := validateImageN(request.N); err != nil {
		return nil, err
	}
	if err := validateResponseFormat(request.ResponseFormat); err != nil {
		return nil, err
	}

	imageRequest := MaaSImageRequest{
		Model:     request.Model,
		Prompt:    request.Prompt,
		Size:      request.Size,
		Watermark: request.Watermark,
	}
	// MaaS only accepts response_format=b64_json; omit the field otherwise so
	// the upstream never sees an unsupported value.
	if request.ResponseFormat == "b64_json" {
		imageRequest.ResponseFormat = request.ResponseFormat
	}
	if err := applySeed(request, &imageRequest); err != nil {
		return nil, err
	}

	if strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
		imageBase64s, err := getImageBase64sFromForm(c)
		if err != nil {
			return nil, fmt.Errorf("get image base64s from form failed: %w", err)
		}
		imageRequest.Image = strings.Join(imageBase64s, ",")
		return &imageRequest, nil
	}

	if len(request.Image) == 0 {
		return nil, errors.New("image is required for huawei MaaS image editing")
	}
	var single string
	if err := common.Unmarshal(request.Image, &single); err == nil {
		if err := validateEditImages([]string{single}); err != nil {
			return nil, err
		}
		imageRequest.Image = single
		return &imageRequest, nil
	}
	var multiple []string
	if err := common.Unmarshal(request.Image, &multiple); err == nil {
		if err := validateEditImages(multiple); err != nil {
			return nil, err
		}
		imageRequest.Image = strings.Join(multiple, ",")
		return &imageRequest, nil
	}
	return nil, errors.New("invalid image field: expected a string or an array of strings")
}

// validateImageN bounds the OpenAI n parameter by dto.MaxImageN before it can
// become a billing multiplier, then rejects n != 1 because MaaS returns a
// single image per call for both generation and editing.
func validateImageN(n *uint) error {
	imageN := uint(1)
	if n != nil && *n > 0 {
		imageN = *n
	}
	if imageN > dto.MaxImageN {
		return types.NewErrorWithStatusCode(fmt.Errorf("n must be between 1 and %d", dto.MaxImageN), types.ErrorCodeInvalidRequest, http.StatusBadRequest)
	}
	if imageN != 1 {
		return types.NewErrorWithStatusCode(errors.New("huawei MaaS supports only one image per request (n must be 1)"), types.ErrorCodeInvalidRequest, http.StatusBadRequest)
	}
	return nil
}

// validateResponseFormat rejects response_format=url up front: MaaS only ever
// returns base64 payloads, so a client asking for URLs would get unusable data.
func validateResponseFormat(format string) error {
	if format == "url" {
		return types.NewErrorWithStatusCode(errors.New("huawei MaaS does not support response_format=url; only b64_json is available"), types.ErrorCodeInvalidRequest, http.StatusBadRequest)
	}
	return nil
}

// validateEditImages enforces the MaaS image-edit constraints: 1 to
// maxEditImages images, each a public URL or a base64 data URI. Raw base64
// without the "data:image/...;base64," prefix is rejected by the upstream.
func validateEditImages(images []string) error {
	if len(images) == 0 || len(images) > maxEditImages {
		return fmt.Errorf("huawei MaaS image editing supports 1 to %d images per request", maxEditImages)
	}
	for _, image := range images {
		if strings.HasPrefix(image, "http://") || strings.HasPrefix(image, "https://") {
			continue
		}
		if strings.HasPrefix(image, "data:image/") && strings.Contains(image, ";base64,") {
			continue
		}
		return errors.New(`image must be a public URL or a base64 data URI (e.g. "data:image/jpg;base64,...")`)
	}
	return nil
}

// applySeed reads the OpenAI-style seed from the request's extra fields; MaaS
// has no top-level seed field in the dto.ImageRequest.
func applySeed(request dto.ImageRequest, imageRequest *MaaSImageRequest) error {
	if request.Extra == nil {
		return nil
	}
	seedRaw, ok := request.Extra["seed"]
	if !ok {
		return nil
	}
	var seed int
	if err := common.Unmarshal(seedRaw, &seed); err != nil {
		return fmt.Errorf("invalid seed field: %w", err)
	}
	imageRequest.Seed = &seed
	return nil
}

// getImageBase64sFromForm extracts uploaded image files (from the "image",
// "image[]" or "image[...]" form fields) and encodes them as base64 data URLs
// for the MaaS edit request.
func getImageBase64sFromForm(c *gin.Context) ([]string, error) {
	mf := c.Request.MultipartForm
	if mf == nil {
		if _, err := c.MultipartForm(); err != nil {
			return nil, fmt.Errorf("failed to parse image edit form request: %w", err)
		}
		mf = c.Request.MultipartForm
	}

	var imageFiles []*multipart.FileHeader
	var exists bool
	if imageFiles, exists = mf.File["image"]; !exists || len(imageFiles) == 0 {
		if imageFiles, exists = mf.File["image[]"]; !exists || len(imageFiles) == 0 {
			foundArrayImages := false
			for fieldName, files := range mf.File {
				if strings.HasPrefix(fieldName, "image[") && len(files) > 0 {
					foundArrayImages = true
					imageFiles = append(imageFiles, files...)
				}
			}
			if !foundArrayImages && len(imageFiles) == 0 {
				return nil, errors.New("image is required")
			}
		}
	}

	if len(imageFiles) == 0 {
		return nil, errors.New("image is required")
	}
	if len(imageFiles) > maxEditImages {
		return nil, fmt.Errorf("huawei MaaS image editing supports 1 to %d images per request", maxEditImages)
	}

	imageBase64s := make([]string, 0, len(imageFiles))
	for _, file := range imageFiles {
		image, err := file.Open()
		if err != nil {
			return nil, errors.New("failed to open image file")
		}
		imageData, readErr := io.ReadAll(image)
		image.Close()
		if readErr != nil {
			return nil, errors.New("failed to read image file")
		}
		mimeType := http.DetectContentType(imageData)
		imageBase64s = append(imageBase64s, fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(imageData)))
	}
	return imageBase64s, nil
}

// huaweiImageHandler converts the MaaS image response (whose b64_json values
// are data URIs) into the OpenAI image response shape and sets the "n" billing
// ratio from the actual number of returned images.
func huaweiImageHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)

	var imageResp MaaSImageResponse
	if err := common.Unmarshal(responseBody, &imageResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if imageResp.Error != nil {
		return nil, types.WithOpenAIError(types.OpenAIError{Message: fmt.Sprintf("huawei maas image error: %v", imageResp.Error)}, resp.StatusCode)
	}

	imageResponse := dto.ImageResponse{
		Created:  info.StartTime.Unix(),
		Metadata: responseBody,
	}
	for _, data := range imageResp.Data {
		b64Json := data.B64Json
		// Strip the "data:<mime>;base64," prefix so b64_json carries the raw
		// payload expected by OpenAI-style clients; url is passed through
		// unchanged (MaaS returns null for b64 responses).
		if idx := strings.Index(b64Json, ";base64,"); idx >= 0 {
			b64Json = b64Json[idx+len(";base64,"):]
		}
		imageResponse.Data = append(imageResponse.Data, dto.ImageData{
			Url:     data.Url,
			B64Json: b64Json,
		})
	}

	// Same guard as openai's updateOpenAIImageCount: an out-of-range image
	// count must never become a billing multiplier; the requested n from the
	// pre-consume estimate stays in effect instead.
	imageCount := len(imageResponse.Data)
	if imageCount > 0 && imageCount <= dto.MaxImageN {
		info.PriceData.AddOtherRatio("n", float64(imageCount))
	}

	jsonResponse, err := common.Marshal(imageResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	service.IOCopyBytesGracefully(c, resp, jsonResponse)

	usage := &dto.Usage{
		PromptTokens:     imageResp.Usage.PromptTokens,
		CompletionTokens: imageResp.Usage.CompletionTokens,
		TotalTokens:      imageResp.Usage.TotalTokens,
	}
	if usage.TotalTokens == 0 {
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}
	return usage, nil
}
