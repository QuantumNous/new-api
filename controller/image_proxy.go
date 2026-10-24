package controller

import (
	"bufio"
	"errors"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// ImageProxy serves an image using an authenticated capability.
func ImageProxy(c *gin.Context) {
	setTaskMediaResponseSecurityHeaders(c.Writer.Header())
	if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
		c.Header("Allow", "GET, HEAD")
		imageProxyError(c, http.StatusMethodNotAllowed, "invalid_request_error", i18n.MsgImageProxyMethod)
		return
	}
	target, err := service.ReadImageProxyToken(c.Query("token"))
	if err != nil {
		imageProxyError(c, http.StatusForbidden, "invalid_request_error", i18n.MsgImageProxyInvalid)
		return
	}
	channel, err := model.CacheGetChannel(target.ChannelID)
	if err != nil || channel == nil {
		imageProxyError(c, http.StatusServiceUnavailable, "server_error", i18n.MsgImageProxyUnavailable)
		return
	}
	parsedURL, err := url.Parse(target.URL)
	if err != nil || isSelfImageProxyURL(c, parsedURL) {
		imageProxyError(c, http.StatusBadGateway, "server_error", i18n.MsgImageProxyDownloadFailed)
		return
	}
	settings := channel.GetSetting()
	proxy := strings.TrimSpace(settings.Proxy)
	if err := validateTaskMediaURL(target.URL, proxy); err != nil {
		imageProxyError(c, http.StatusBadGateway, "server_error", i18n.MsgImageProxyDownloadFailed)
		return
	}
	client := service.GetSSRFProtectedHTTPClient()
	if proxy != "" {
		client, err = service.GetHttpClientWithProxySettings(proxy, settings)
		if err != nil {
			imageProxyError(c, http.StatusServiceUnavailable, "server_error", i18n.MsgImageProxyUnavailable)
			return
		}
	}
	if client == nil {
		imageProxyError(c, http.StatusServiceUnavailable, "server_error", i18n.MsgImageProxyUnavailable)
		return
	}
	// Some image hosts only serve GET, so HEAD inspects the same image prefix.
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, target.URL, nil)
	if err != nil {
		imageProxyError(c, http.StatusBadGateway, "server_error", i18n.MsgImageProxyDownloadFailed)
		return
	}
	req.Header.Set("Accept", "image/*")
	downloadClient := *client
	downloadClient.Jar = nil
	downloadClient.Timeout = 0
	downloadClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if len(via) >= 10 {
			return service.ErrImageProxyInvalid
		}
		if err := service.ValidateImageProxyTargetURL(req.URL.String()); err != nil {
			return err
		}
		if isSelfImageProxyURL(c, req.URL) {
			return service.ErrImageProxyInvalid
		}
		if err := validateTaskMediaURL(req.URL.String(), proxy); err != nil {
			return service.ErrImageProxyInvalid
		}
		req.Header = make(http.Header)
		req.Header.Set("Accept", "image/*")
		return nil
	}
	resp, err := doTaskMediaRequest(&downloadClient, req, taskMediaResponseHeaderTimeout)
	if err != nil {
		imageProxyError(c, http.StatusBadGateway, "server_error", i18n.MsgImageProxyDownloadFailed)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		imageProxyError(c, http.StatusBadGateway, "server_error", i18n.MsgImageProxyDownloadFailed)
		return
	}
	mediaType := ""
	if contentType := resp.Header.Get("Content-Type"); contentType != "" {
		mediaType, _, err = mime.ParseMediaType(contentType)
		if err != nil {
			imageProxyError(c, http.StatusBadGateway, "server_error", i18n.MsgImageProxyUnsupported)
			return
		}
	}
	body := bufio.NewReaderSize(resp.Body, 512)
	prefix, err := body.Peek(512)
	if err != nil && !errors.Is(err, io.EOF) {
		imageProxyError(c, http.StatusBadGateway, "server_error", i18n.MsgImageProxyDownloadFailed)
		return
	}
	detected := http.DetectContentType(prefix)
	if detected != "application/octet-stream" {
		mediaType = detected
	} else {
		// These raster formats are not recognized by DetectContentType.
		switch mediaType {
		case "image/avif", "image/heic", "image/heif", "image/jxl", "image/tiff":
		default:
			mediaType = detected
		}
	}
	switch mediaType {
	case "image/png", "image/apng", "image/jpeg", "image/gif", "image/webp", "image/avif",
		"image/bmp", "image/x-ms-bmp", "image/tiff", "image/x-icon", "image/vnd.microsoft.icon",
		"image/heic", "image/heif", "image/jxl":
	default:
		imageProxyError(c, http.StatusBadGateway, "server_error", i18n.MsgImageProxyUnsupported)
		return
	}
	c.Header("Content-Type", mediaType)
	if resp.ContentLength >= 0 {
		c.Header("Content-Length", strconv.FormatInt(resp.ContentLength, 10))
	}
	c.Status(http.StatusOK)
	if c.Request.Method == http.MethodHead {
		return
	}
	if _, err := io.Copy(c.Writer, body); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Failed to stream image"))
	}
}

func imageProxyError(c *gin.Context, status int, errorType, message string) {
	if c.Request.Method == http.MethodHead {
		c.Status(status)
		return
	}
	videoProxyError(c, status, errorType, i18n.T(c, message))
}

func isSelfImageProxyURL(c *gin.Context, target *url.URL) bool {
	if target == nil {
		return false
	}
	proxyPath := path.Clean(target.Path)
	if !strings.HasSuffix(proxyPath, "/v1/images/proxy") {
		return false
	}
	for _, address := range []string{system_setting.TaskPublicAddress, system_setting.ServerAddress} {
		base, err := url.Parse(strings.TrimSpace(address))
		if err == nil && base.Host != "" && sameTaskMediaOrigin(base, target) &&
			proxyPath == path.Clean(strings.TrimRight(base.Path, "/")+"/v1/images/proxy") {
			return true
		}
	}
	scheme := c.Request.URL.Scheme
	if scheme == "" {
		scheme = "http"
		if c.Request.TLS != nil {
			scheme = "https"
		}
	}
	return proxyPath == path.Clean(c.Request.URL.Path) &&
		sameTaskMediaOrigin(&url.URL{Scheme: scheme, Host: c.Request.Host}, target)
}
