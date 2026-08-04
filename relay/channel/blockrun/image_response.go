package blockrun

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

var uploadTempMediaImageForBlockRun = service.UploadTempMediaImage

// ensureImageB64 fills item.B64Json by downloading item.Url when only a URL is
// present (whitelabel: the client receives bytes, never the upstream CDN host),
// then blanks the URL. When bytes are already present it still blanks any URL so
// the two never ship together (defends against an upstream that returns both).
// On download failure it degrades — keep the URL, log a warning — because the
// upstream charge already happened and failing a paid, completed generation is
// worse than a rare whitelabel leak.
//
// Note: this deliberately overrides response_format=url — BlockRun image
// results are always delivered as b64_json so the upstream CDN host is never
// exposed to the client. This is a conscious whitelabel trade-off.
func ensureImageB64(c *gin.Context, info *relaycommon.RelayInfo, item *dto.ImageData) {
	if isBlockrunTempURL(info) {
		if ensureImageTempURL(c, info, item) {
			return
		}
	}
	if item.B64Json != "" {
		item.Url = "" // never expose the CDN host alongside bytes already in hand
		return
	}
	if item.Url == "" {
		return
	}
	b64, err := downloadImageAsBase64(c, info, item.Url)
	if err != nil {
		logger.LogWarn(c, fmt.Sprintf("blockrun image: b64 conversion failed, returning upstream url (whitelabel degraded): %s", err))
		return
	}
	item.B64Json = b64
	item.Url = ""
}

func isBlockrunTempURL(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return false
	}
	request, ok := info.Request.(*dto.ImageRequest)
	return ok && request != nil && request.TempUrl != nil && *request.TempUrl
}

func ensureImageTempURL(c *gin.Context, info *relaycommon.RelayInfo, item *dto.ImageData) bool {
	raw, contentType, err := imagePayloadBytesFromItem(info, c, item)
	if err != nil {
		logger.LogWarn(c, fmt.Sprintf("blockrun image: failed to prepare image payload for temp url: %v", err))
		return false
	}
	contentType = normalizeImageContentType(contentType, raw, item)
	requestContext := context.Background()
	if c != nil && c.Request != nil {
		requestContext = c.Request.Context()
	}
	result, err := uploadTempMediaImageForBlockRun(requestContext, service.TempMediaUploadRequest{
		UserID:      info.UserId,
		Filename:    "gpt-image-" + imageExtFromContentType(contentType),
		ContentType: contentType,
		Size:        int64(len(raw)),
		Body:        bytes.NewReader(raw),
	})
	if err != nil {
		logger.LogWarn(c, fmt.Sprintf("blockrun image: failed to upload temp media: %v", err))
		return false
	}
	item.Url = result.SignedURL
	item.B64Json = ""
	item.ExpiresAt = result.ExpiresAt
	item.ExpiresIn = result.ExpiresIn
	return true
}

func imagePayloadBytesFromItem(info *relaycommon.RelayInfo, c *gin.Context, item *dto.ImageData) ([]byte, string, error) {
	if item == nil {
		return nil, "", fmt.Errorf("blockrun image: empty image item")
	}
	if item.B64Json != "" {
		rawText := item.B64Json
		if strings.HasPrefix(rawText, "data:") {
			if comma := strings.Index(rawText, ","); comma >= 0 {
				rawText = rawText[comma+1:]
			}
		}
		raw, err := base64.StdEncoding.DecodeString(rawText)
		if err != nil {
			return nil, "", fmt.Errorf("decode b64_json: %w", err)
		}
		if len(raw) == 0 {
			return nil, "", fmt.Errorf("empty b64 payload")
		}
		return raw, "image/png", nil
	}
	if item.Url != "" {
		raw, ct, err := downloadImageBytes(item.Url, info, c)
		if err != nil {
			return nil, "", err
		}
		if len(raw) == 0 {
			return nil, "", fmt.Errorf("empty image download")
		}
		return raw, ct, nil
	}
	return nil, "", fmt.Errorf("image item has no url or b64_json")
}

func normalizeImageContentType(rawType string, raw []byte, item *dto.ImageData) string {
	t := strings.ToLower(strings.TrimSpace(strings.TrimSuffix(strings.Split(rawType, ";")[0], ";")))
	switch t {
	case "image/jpeg", "image/jpg":
		return "image/jpeg"
	case "image/webp":
		return "image/webp"
	case "image/png":
		return "image/png"
	}
	// Infer from payload and URL when the upstream response did not set a usable MIME.
	if len(raw) > 0 {
		detected := strings.ToLower(strings.TrimSpace(strings.Split(http.DetectContentType(raw), ";")[0]))
		if detected == "image/jpeg" || detected == "image/jpg" || detected == "image/png" || detected == "image/webp" {
			return detected
		}
	}
	if item == nil {
		return "image/png"
	}
	u := strings.ToLower(path.Ext(stripImageQuery(item.Url)))
	switch u {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".png":
		return "image/png"
	}
	return "image/png"
}

func imageExtFromContentType(contentType string) string {
	switch strings.ToLower(strings.TrimSpace(contentType)) {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	default:
		return ".png"
	}
}

func stripImageQuery(raw string) string {
	if raw == "" {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	u.RawQuery = ""
	u.Fragment = ""
	return u.Path
}

func downloadImageBytes(imageURL string, info *relaycommon.RelayInfo, c *gin.Context) ([]byte, string, error) {
	b64, err := downloadImageAsBase64WithMetadata(c, info, imageURL)
	if err != nil {
		return nil, "", err
	}
	return b64.Bytes, b64.ContentType, nil
}

type imageBytes struct {
	Bytes       []byte
	ContentType string
}

func downloadImageAsBase64WithMetadata(c *gin.Context, info *relaycommon.RelayInfo, imageURL string) (imageBytes, error) {
	fs := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(imageURL, fs.EnableSSRFProtection, fs.AllowPrivateIp, fs.DomainFilterMode, fs.IpFilterMode, fs.DomainList, fs.IpList, fs.AllowedPorts, fs.ApplyIPFilterForDomain); err != nil {
		return imageBytes{}, fmt.Errorf("blockrun: image download url blocked: %w", err)
	}
	proxy := ""
	if info != nil {
		proxy = info.ChannelSetting.Proxy
	}
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return imageBytes{}, err
	}
	if client == nil {
		client = http.DefaultClient
	}
	ctx := context.Background()
	if c != nil && c.Request != nil {
		ctx = c.Request.Context()
	}
	ctx, cancel := context.WithTimeout(ctx, imageDownloadTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	if err != nil {
		return imageBytes{}, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return imageBytes{}, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return imageBytes{}, fmt.Errorf("image download status %d", resp.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxImageBodyBytes+1))
	if err != nil {
		return imageBytes{}, err
	}
	if len(raw) > maxImageBodyBytes {
		return imageBytes{}, fmt.Errorf("image exceeds %d bytes", maxImageBodyBytes)
	}
	return imageBytes{Bytes: raw, ContentType: resp.Header.Get("Content-Type")}, nil
}

// imageJSONResponseB64 is the non-streaming image DoResponse: read the completed
// upstream body, convert each image to base64 (ensureImageB64), write a clean
// OpenAI-compatible {created, data:[{b64_json, …}]} response. Settlement signals
// were captured in resolveImageResult, so usage is empty and ImageHelper applies
// the per-image price.
func imageJSONResponseB64(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	body, err := readAndCloseBody(resp)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeReadResponseBodyFailed, types.ErrOptionWithSkipRetry())
	}
	var ir dto.ImageResponse
	if uerr := common.Unmarshal(body, &ir); uerr != nil || len(ir.Data) == 0 {
		return nil, types.NewError(fmt.Errorf("blockrun: image response carried no image data"), types.ErrorCodeBadResponseBody, types.ErrOptionWithSkipRetry())
	}
	for i := range ir.Data {
		ensureImageB64(c, info, &ir.Data[i])
	}
	out, merr := common.Marshal(ir)
	if merr != nil {
		return nil, types.NewError(merr, types.ErrorCodeBadResponseBody, types.ErrOptionWithSkipRetry())
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.Header().Set("Content-Length", strconv.Itoa(len(out)))
	c.Writer.WriteHeader(http.StatusOK)
	_, _ = c.Writer.Write(out)
	return &dto.Usage{}, nil
}
