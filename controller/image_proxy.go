package controller

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

// 图片代理上限，图片足够用且防止滥用
const maxImageProxyBytes = 25 << 20 // 25MB

// 仅放行栅格图，拒绝 image/svg+xml 等可执行脚本的类型，防止同源 XSS。
var allowedImageContentTypes = map[string]bool{
	"image/png":                true,
	"image/jpeg":               true,
	"image/jpg":                true,
	"image/webp":               true,
	"image/gif":                true,
	"image/bmp":                true,
	"image/avif":               true,
	"image/x-icon":             true,
	"image/vnd.microsoft.icon": true,
}

// 仅允许 http/https、80/443 端口，禁止内网/保留地址（含域名解析后的 IP），防 SSRF。
var imageProxySSRF = &common.SSRFProtection{
	AllowPrivateIp:         false,
	DomainFilterMode:       false, // 黑名单模式 + 空名单 => 放行所有公网域名
	IpFilterMode:           false, // 黑名单模式 + 空名单 => 放行所有公网 IP（私网由 AllowPrivateIp 拦截）
	AllowedPorts:           []int{80, 443},
	ApplyIPFilterForDomain: true, // 域名解析后的 IP 也要过私网校验
}

// 每一跳重定向都重新过 SSRF 校验，防止公网 URL 302 跳转到内网/元数据地址绕过防护。
var imageProxyClient = &http.Client{
	Timeout: 30 * time.Second,
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return errors.New("too many redirects")
		}
		return imageProxySSRF.ValidateURL(req.URL.String())
	},
}

// PlaygroundImageProxy 代理拉取远程图片，绕开浏览器对供应商 CDN 的 CORS 限制，
// 供已登录用户在图片模型页复制/下载使用。仅做透传，不落盘。
func PlaygroundImageProxy(c *gin.Context) {
	raw := c.Query("url")
	if raw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing url"})
		return
	}
	if err := imageProxySSRF.ValidateURL(raw); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, raw, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid url"})
		return
	}

	resp, err := imageProxyClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "fetch failed"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": "upstream status " + resp.Status})
		return
	}

	// 只取 MIME 主体（去掉 charset 等参数），且仅放行栅格图，拒绝 SVG 等可执行类型。
	contentType := strings.ToLower(strings.TrimSpace(
		strings.SplitN(resp.Header.Get("Content-Type"), ";", 2)[0],
	))
	if !allowedImageContentTypes[contentType] {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "unsupported image type"})
		return
	}

	// 先限量读入（max+1 字节）再写出：超过上限直接 413，避免静默截断成坏图。
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxImageProxyBytes+1))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "read failed"})
		return
	}
	if int64(len(data)) > maxImageProxyBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "image too large"})
		return
	}

	// 防 sniff + 强制下载，避免被当成可导航的同源页面执行脚本。
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Content-Disposition", "attachment")
	c.Header("Cache-Control", "private, max-age=300")
	c.Data(http.StatusOK, contentType, data)
}
