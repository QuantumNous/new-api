package service

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// maxLightweightSniffBytes 是估算阶段 MIME 嗅探的最大读取字节数。
// 512 字节对 http.DetectContentType 足够识别绝大多数常见格式
// （图片/音频/视频/PDF/EXE 等都有显著 magic bytes）。
const maxLightweightSniffBytes = 512

// DetectMimeTypeLightweight 轻量级 MIME 类型检测，用于估算阶段。
// URL 来源最多读取 maxLightweightSniffBytes 字节用于嗅探，不下载完整文件，不缓存数据。
// 优先级：已缓存 > 来源携带的 MimeType > HTTP 响应头 > URL 扩展名 > 内容嗅探(512B)。
func DetectMimeTypeLightweight(c *gin.Context, source types.FileSource) (string, error) {
	if source == nil {
		return "application/octet-stream", nil
	}

	// 优先复用中继阶段已加载的缓存（不重复下载）
	if source.HasCache() {
		return source.GetCache().MimeType, nil
	}

	switch s := source.(type) {
	case *types.URLSource:
		return sniffMimeTypeFromURL(c, s.URL)
	case *types.Base64Source:
		if s.MimeType != "" {
			return s.MimeType, nil
		}
		return sniffMimeTypeFromBase64(s.Base64Data)
	}

	return "application/octet-stream", nil
}

// sniffMimeTypeFromURL 通过 HTTP 请求获取 MIME 类型，最多读取 512 字节用于内容嗅探。
func sniffMimeTypeFromURL(c *gin.Context, url string) (string, error) {
	response, err := DoDownloadRequest(url, "sniff_mime_type_lightweight")
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode != 200 {
		return "", fmt.Errorf("failed to download file, status code: %d", response.StatusCode)
	}

	// 1. Content-Type header
	if mt := mimeTypeFromHeaders(response); mt != "" {
		return mt, nil
	}

	// 2. URL 扩展名
	if mt := guessMimeTypeFromURL(url); mt != "application/octet-stream" {
		return mt, nil
	}

	// 3. 读取前 512 字节做内容嗅探
	sniffBuf := make([]byte, maxLightweightSniffBytes)
	n, _ := io.ReadFull(response.Body, sniffBuf)
	if n > 0 {
		if mt := sniffBytes(sniffBuf[:n]); mt != "" {
			return mt, nil
		}
	}

	return "application/octet-stream", nil
}

// sniffMimeTypeFromBase64 从 base64 数据中解码前 512 字节做内容嗅探。
// 数据本身已在内存中（请求体携带），仅做最小解码用于类型识别。
func sniffMimeTypeFromBase64(base64String string) (string, error) {
	cleaned := base64String
	if strings.HasPrefix(cleaned, "data:") {
		if idx := strings.Index(cleaned, ","); idx != -1 {
			cleaned = cleaned[idx+1:]
		}
	}

	// base64 编码每 4 字符对应 3 字节，684 字符即可解码出 512 字节
	maxChars := (maxLightweightSniffBytes*4 + 2) / 3
	if len(cleaned) > maxChars {
		// 截取到 4 字符对齐边界，避免解码失败
		aligned := maxChars - (maxChars % 4)
		if aligned < 4 {
			aligned = 4
		}
		cleaned = cleaned[:aligned]
	}

	decoded, err := base64.StdEncoding.DecodeString(cleaned)
	if err != nil || len(decoded) == 0 {
		return "application/octet-stream", nil
	}

	if mt := sniffBytes(decoded); mt != "" {
		return mt, nil
	}
	return "application/octet-stream", nil
}

// mimeTypeFromHeaders 从 HTTP 响应头（Content-Type / Content-Disposition）推断 MIME 类型。
func mimeTypeFromHeaders(resp *http.Response) string {
	if headerType := strings.TrimSpace(resp.Header.Get("Content-Type")); headerType != "" {
		if i := strings.Index(headerType, ";"); i != -1 {
			headerType = strings.TrimSpace(headerType[:i])
		}
		if headerType != "" && headerType != "application/octet-stream" {
			return headerType
		}
	}

	if cd := resp.Header.Get("Content-Disposition"); cd != "" {
		for _, part := range strings.Split(cd, ";") {
			part = strings.TrimSpace(part)
			if !strings.HasPrefix(strings.ToLower(part), "filename=") {
				continue
			}
			name := strings.TrimSpace(strings.TrimPrefix(part, "filename="))
			if len(name) > 2 && name[0] == '"' && name[len(name)-1] == '"' {
				name = name[1 : len(name)-1]
			}
			if dot := strings.LastIndex(name, "."); dot != -1 && dot+1 < len(name) {
				if mt := GetMimeTypeByExtension(strings.ToLower(name[dot+1:])); mt != "application/octet-stream" {
					return mt
				}
			}
			break
		}
	}

	return ""
}

// sniffBytes 使用 http.DetectContentType + HEIF/HEIC 检测 + 图片解码配置识别 MIME 类型。
func sniffBytes(data []byte) string {
	if len(data) == 0 {
		return ""
	}

	if sniffed := http.DetectContentType(data); sniffed != "" && sniffed != "application/octet-stream" {
		if i := strings.Index(sniffed, ";"); i != -1 {
			sniffed = strings.TrimSpace(sniffed[:i])
		}
		return sniffed
	}

	if heifMime := detectHEIF(data); heifMime != "" {
		return heifMime
	}

	if _, format, err := image.DecodeConfig(bytes.NewReader(data)); err == nil && format != "" {
		return "image/" + strings.ToLower(format)
	}

	return ""
}

// GetFileTypeFromUrl 获取文件类型，返回 mime type， 例如 image/jpeg, image/png, image/gif, image/bmp, image/tiff, application/pdf
// 如果获取失败，返回 application/octet-stream
func GetFileTypeFromUrl(c *gin.Context, url string, reason ...string) (string, error) {
	response, err := DoDownloadRequest(url, []string{"get_mime_type", strings.Join(reason, ", ")}...)
	if err != nil {
		common.SysLog(fmt.Sprintf("fail to get file type from url: %s, error: %s", url, err.Error()))
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode != 200 {
		logger.LogError(c, fmt.Sprintf("failed to download file from %s, status code: %d", url, response.StatusCode))
		return "", fmt.Errorf("failed to download file, status code: %d", response.StatusCode)
	}

	if headerType := strings.TrimSpace(response.Header.Get("Content-Type")); headerType != "" {
		if i := strings.Index(headerType, ";"); i != -1 {
			headerType = headerType[:i]
		}
		if headerType != "application/octet-stream" {
			return headerType, nil
		}
	}

	if cd := response.Header.Get("Content-Disposition"); cd != "" {
		parts := strings.Split(cd, ";")
		for _, part := range parts {
			part = strings.TrimSpace(part)
			if strings.HasPrefix(strings.ToLower(part), "filename=") {
				name := strings.TrimSpace(strings.TrimPrefix(part, "filename="))
				if len(name) > 2 && name[0] == '"' && name[len(name)-1] == '"' {
					name = name[1 : len(name)-1]
				}
				if dot := strings.LastIndex(name, "."); dot != -1 && dot+1 < len(name) {
					ext := strings.ToLower(name[dot+1:])
					if ext != "" {
						mt := GetMimeTypeByExtension(ext)
						if mt != "application/octet-stream" {
							return mt, nil
						}
					}
				}
				break
			}
		}
	}

	cleanedURL := url
	if q := strings.Index(cleanedURL, "?"); q != -1 {
		cleanedURL = cleanedURL[:q]
	}
	if slash := strings.LastIndex(cleanedURL, "/"); slash != -1 && slash+1 < len(cleanedURL) {
		last := cleanedURL[slash+1:]
		if dot := strings.LastIndex(last, "."); dot != -1 && dot+1 < len(last) {
			ext := strings.ToLower(last[dot+1:])
			if ext != "" {
				mt := GetMimeTypeByExtension(ext)
				if mt != "application/octet-stream" {
					return mt, nil
				}
			}
		}
	}

	var readData []byte
	limits := []int{512, 8 * 1024, 24 * 1024, 64 * 1024}
	for _, limit := range limits {
		logger.LogDebug(c, "Trying to read %d bytes to determine file type", limit)
		if len(readData) < limit {
			need := limit - len(readData)
			tmp := make([]byte, need)
			n, _ := io.ReadFull(response.Body, tmp)
			if n > 0 {
				readData = append(readData, tmp[:n]...)
			}
		}

		if len(readData) == 0 {
			continue
		}

		sniffed := http.DetectContentType(readData)
		if sniffed != "" && sniffed != "application/octet-stream" {
			return sniffed, nil
		}

		// Try HEIF/HEIC detection (Go standard library doesn't recognize it)
		if heifMime := detectHEIF(readData); heifMime != "" {
			return heifMime, nil
		}

		if _, format, err := image.DecodeConfig(bytes.NewReader(readData)); err == nil {
			switch strings.ToLower(format) {
			case "jpeg", "jpg":
				return "image/jpeg", nil
			case "png":
				return "image/png", nil
			case "gif":
				return "image/gif", nil
			case "bmp":
				return "image/bmp", nil
			case "tiff":
				return "image/tiff", nil
			default:
				if format != "" {
					return "image/" + strings.ToLower(format), nil
				}
			}
		}
	}

	// Fallback
	return "application/octet-stream", nil
}

// GetFileBase64FromUrl 从 URL 获取文件的 base64 编码数据
// Deprecated: 请使用 GetBase64Data 配合 types.NewURLFileSource 替代
// 此函数保留用于向后兼容，内部已重构为调用统一的文件服务
func GetFileBase64FromUrl(c *gin.Context, url string, reason ...string) (*types.LocalFileData, error) {
	source := types.NewURLFileSource(url)
	cachedData, err := LoadFileSource(c, source, reason...)
	if err != nil {
		return nil, err
	}

	// 转换为旧的 LocalFileData 格式以保持兼容
	base64Data, err := cachedData.GetBase64Data()
	if err != nil {
		return nil, err
	}
	return &types.LocalFileData{
		Base64Data: base64Data,
		MimeType:   cachedData.MimeType,
		Size:       cachedData.Size,
		Url:        url,
	}, nil
}

func GetMimeTypeByExtension(ext string) string {
	// Convert to lowercase for case-insensitive comparison
	ext = strings.ToLower(ext)
	switch ext {
	// Text files
	case "txt", "md", "markdown", "csv", "json", "xml", "html", "htm":
		return "text/plain"

	// Image files
	case "jpg", "jpeg":
		return "image/jpeg"
	case "png":
		return "image/png"
	case "gif":
		return "image/gif"
	case "jfif":
		return "image/jpeg"
	case "heic":
		return "image/heic"
	case "heif":
		return "image/heif"

	// Audio files
	case "mp3":
		return "audio/mp3"
	case "wav":
		return "audio/wav"
	case "mpeg":
		return "audio/mpeg"

	// Video files
	case "mp4":
		return "video/mp4"
	case "wmv":
		return "video/wmv"
	case "flv":
		return "video/flv"
	case "mov":
		return "video/mov"
	case "mpg":
		return "video/mpg"
	case "avi":
		return "video/avi"
	case "mpegps":
		return "video/mpegps"

	// Document files
	case "pdf":
		return "application/pdf"

	default:
		return "application/octet-stream" // Default for unknown types
	}
}
