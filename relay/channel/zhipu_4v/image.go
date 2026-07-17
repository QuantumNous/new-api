package zhipu_4v

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type zhipuImageRequest struct {
	Model            string `json:"model"`
	Prompt           string `json:"prompt"`
	Quality          string `json:"quality,omitempty"`
	Size             string `json:"size,omitempty"`
	WatermarkEnabled *bool  `json:"watermark_enabled,omitempty"`
	UserID           string `json:"user_id,omitempty"`
}

type zhipuImageResponse struct {
	Created       *int64            `json:"created,omitempty"`
	Data          []zhipuImageData  `json:"data,omitempty"`
	ContentFilter any               `json:"content_filter,omitempty"`
	Usage         *dto.Usage        `json:"usage,omitempty"`
	Error         *zhipuImageError  `json:"error,omitempty"`
	RequestID     string            `json:"request_id,omitempty"`
	ExtendParam   map[string]string `json:"extendParam,omitempty"`
}

type zhipuImageError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type zhipuImageData struct {
	Url      string `json:"url,omitempty"`
	ImageUrl string `json:"image_url,omitempty"`
	B64Json  string `json:"b64_json,omitempty"`
	B64Image string `json:"b64_image,omitempty"`
}

type openAIImagePayload struct {
	Created int64             `json:"created"`
	Data    []openAIImageData `json:"data"`
}

type openAIImageData struct {
	Url     string `json:"url,omitempty"`
	B64Json string `json:"b64_json,omitempty"`
}

func zhipu4vImageHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)

	var zhipuResp zhipuImageResponse
	if err := common.Unmarshal(responseBody, &zhipuResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if zhipuResp.Error != nil && zhipuResp.Error.Message != "" {
		return nil, types.WithOpenAIError(types.OpenAIError{
			Message: zhipuResp.Error.Message,
			Type:    "zhipu_image_error",
			Code:    zhipuResp.Error.Code,
		}, resp.StatusCode)
	}

	payload := openAIImagePayload{}
	if zhipuResp.Created != nil && *zhipuResp.Created != 0 {
		payload.Created = *zhipuResp.Created
	} else {
		payload.Created = info.StartTime.Unix()
	}
	wantsURL := false
	if request, ok := info.Request.(*dto.ImageRequest); ok {
		wantsURL = strings.EqualFold(strings.TrimSpace(request.ResponseFormat), "url")
	}
	for _, data := range zhipuResp.Data {
		imageURL := data.Url
		if imageURL == "" {
			imageURL = data.ImageUrl
		}

		if wantsURL && imageURL != "" {
			payload.Data = append(payload.Data, openAIImageData{Url: imageURL})
			continue
		}

		var b64 string
		switch {
		case data.B64Json != "":
			b64 = data.B64Json
		case data.B64Image != "":
			b64 = data.B64Image
		default:
			if imageURL == "" {
				logger.LogWarn(c, "zhipu_image_missing_data")
				continue
			}
			maxImageBytes := int64(constant.MaxFileDownloadMB) << 20
			if maxImageBytes <= 0 {
				maxImageBytes = 64 << 20
			}
			downloaded, err := downloadZhipuImageBase64(
				c.Request.Context(),
				service.GetDirectSSRFProtectedHTTPClient(),
				imageURL,
				maxImageBytes,
			)
			if err != nil {
				logger.LogError(c, "zhipu_image_get_b64_failed: "+err.Error())
				continue
			}
			b64 = downloaded
		}

		if b64 == "" {
			logger.LogWarn(c, "zhipu_image_empty_b64")
			continue
		}

		imageData := openAIImageData{
			B64Json: b64,
		}
		payload.Data = append(payload.Data, imageData)
	}

	jsonResp, err := common.Marshal(payload)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}

	service.IOCopyBytesGracefully(c, resp, jsonResp)

	return &dto.Usage{}, nil
}

func downloadZhipuImageBase64(ctx context.Context, client *http.Client, imageURL string, maxBytes int64) (string, error) {
	if client == nil {
		return "", fmt.Errorf("image HTTP client is required")
	}
	if maxBytes <= 0 {
		return "", fmt.Errorf("image size limit must be positive")
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	if err != nil {
		return "", fmt.Errorf("build image request: %w", err)
	}
	if request.URL.Scheme != "http" && request.URL.Scheme != "https" {
		return "", fmt.Errorf("unsupported image URL scheme %q", request.URL.Scheme)
	}
	request.Header.Set("Accept", "image/png,image/jpeg,image/webp,image/gif")
	response, err := client.Do(request)
	if err != nil {
		return "", fmt.Errorf("download image: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode/100 != 2 {
		return "", fmt.Errorf("download image: HTTP %d", response.StatusCode)
	}
	if response.ContentLength > maxBytes {
		return "", fmt.Errorf("image size %d exceeds maximum allowed size of %d bytes", response.ContentLength, maxBytes)
	}

	raw, err := io.ReadAll(io.LimitReader(response.Body, maxBytes+1))
	if err != nil {
		return "", fmt.Errorf("read image data: %w", err)
	}
	if int64(len(raw)) > maxBytes {
		return "", fmt.Errorf("image size exceeds maximum allowed size of %d bytes", maxBytes)
	}
	if len(raw) == 0 {
		return "", fmt.Errorf("image data is empty")
	}

	contentType := strings.ToLower(strings.TrimSpace(strings.Split(response.Header.Get("Content-Type"), ";")[0]))
	if contentType == "" || contentType == "application/octet-stream" {
		contentType = strings.ToLower(http.DetectContentType(raw))
	}
	if !strings.HasPrefix(contentType, "image/") {
		return "", fmt.Errorf("invalid content type: %s, required image/*", contentType)
	}
	return base64.StdEncoding.EncodeToString(raw), nil
}
