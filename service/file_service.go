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
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"golang.org/x/image/webp"
)

// FileService 统一的文件处理服务
// 提供文件下载、解码、缓存等功能的统一入口

// getContextCacheKey 生成 context 缓存的 key
func getContextCacheKey(url string) string {
	return fmt.Sprintf("file_cache_%s", common.GenerateHMAC(url))
}

// LoadFileSource 加载文件源数据
// 这是统一的入口，会自动处理缓存和不同的来源类型
func LoadFileSource(c *gin.Context, source *types.FileSource, reason ...string) (*types.CachedFileData, error) {
	if source == nil {
		return nil, fmt.Errorf("file source is nil")
	}

	if common.DebugEnabled {
		logger.LogDebug(c, fmt.Sprintf("LoadFileSource starting for: %s", source.GetIdentifier()))
	}

	// 1. 快速检查内部缓存
	if source.HasCache() {
		// 即使命中内部缓存，也要确保注册到清理列表（如果尚未注册）
		if c != nil {
			registerSourceForCleanup(c, source)
		}
		return source.GetCache(), nil
	}

	// 2. 加锁保护加载过程
	source.Mu().Lock()
	defer source.Mu().Unlock()

	// 3. 双重检查
	if source.HasCache() {
		if c != nil {
			registerSourceForCleanup(c, source)
		}
		return source.GetCache(), nil
	}

	// 4. 如果是 URL，检查 Context 缓存
	var contextKey string
	if source.IsURL() && c != nil {
		contextKey = getContextCacheKey(source.URL)
		if cachedData, exists := c.Get(contextKey); exists {
			data := cachedData.(*types.CachedFileData)
			source.SetCache(data)
			registerSourceForCleanup(c, source)
			return data, nil
		}
	}

	// 5. 执行加载逻辑
	var cachedData *types.CachedFileData
	var err error

	if source.IsURL() {
		cachedData, err = loadFromURL(c, source.URL, reason...)
	} else {
		cachedData, err = loadFromBase64(source.Base64Data, source.MimeType)
	}

	if err != nil {
		return nil, err
	}

	// 6. 设置缓存
	source.SetCache(cachedData)
	if contextKey != "" && c != nil {
		c.Set(contextKey, cachedData)
	}

	// 7. 注册到 context 以便请求结束时自动清理
	if c != nil {
		registerSourceForCleanup(c, source)
	}

	return cachedData, nil
}

// registerSourceForCleanup 注册 FileSource 到 context 以便请求结束时清理
func registerSourceForCleanup(c *gin.Context, source *types.FileSource) {
	if source.IsRegistered() {
		return
	}

	key := string(constant.ContextKeyFileSourcesToCleanup)
	var sources []*types.FileSource
	if existing, exists := c.Get(key); exists {
		sources = existing.([]*types.FileSource)
	}
	sources = append(sources, source)
	c.Set(key, sources)
	source.SetRegistered(true)
}

// CleanupFileSources 清理请求中所有注册的 FileSource
// 应在请求结束时调用（通常由中间件自动调用）
func CleanupFileSources(c *gin.Context) {
	key := string(constant.ContextKeyFileSourcesToCleanup)
	if sources, exists := c.Get(key); exists {
		for _, source := range sources.([]*types.FileSource) {
			if cache := source.GetCache(); cache != nil {
				cache.Close()
			}
		}
		c.Set(key, nil) // 清除引用
	}
}

// loadFromURL 从 URL 加载文件
func loadFromURL(c *gin.Context, url string, reason ...string) (*types.CachedFileData, error) {
	// 下载文件
	var maxFileSize = constant.MaxFileDownloadMB * 1024 * 1024

	if common.DebugEnabled {
		logger.LogDebug(c, "loadFromURL: initiating download")
	}
	resp, err := DoDownloadRequest(url, reason...)
	if err != nil {
		return nil, fmt.Errorf("failed to download file from %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("failed to download file, status code: %d", resp.StatusCode)
	}

	// 读取文件内容（限制大小）
	if common.DebugEnabled {
		logger.LogDebug(c, "loadFromURL: reading response body")
	}
	fileBytes, err := io.ReadAll(io.LimitReader(resp.Body, int64(maxFileSize+1)))
	if err != nil {
		return nil, fmt.Errorf("failed to read file content: %w", err)
	}
	if len(fileBytes) > maxFileSize {
		return nil, fmt.Errorf("file size exceeds maximum allowed size: %dMB", constant.MaxFileDownloadMB)
	}

	// 转换为 base64
	base64Data := base64.StdEncoding.EncodeToString(fileBytes)

	// 智能获取 MIME 类型
	mimeType := smartDetectMimeType(resp, url, fileBytes)

	// 判断是否使用磁盘缓存
	base64Size := int64(len(base64Data))
	var cachedData *types.CachedFileData

	if shouldUseDiskCache(base64Size) {
		// 使用磁盘缓存
		diskPath, err := writeToDiskCache(base64Data)
		if err != nil {
			// 磁盘缓存失败，回退到内存
			logger.LogWarn(c, fmt.Sprintf("Failed to write to disk cache, falling back to memory: %v", err))
			cachedData = types.NewMemoryCachedData(base64Data, mimeType, int64(len(fileBytes)))
		} else {
			cachedData = types.NewDiskCachedData(diskPath, mimeType, int64(len(fileBytes)))
			cachedData.DiskSize = base64Size
			cachedData.OnClose = func(size int64) {
				common.DecrementDiskFiles(size)
			}
			common.IncrementDiskFiles(base64Size)
			if common.DebugEnabled {
				logger.LogDebug(c, fmt.Sprintf("File cached to disk: %s, size: %d bytes", diskPath, base64Size))
			}
		}
	} else {
		// 使用内存缓存
		cachedData = types.NewMemoryCachedData(base64Data, mimeType, int64(len(fileBytes)))
	}

	// 如果是图片，尝试获取图片配置
	if strings.HasPrefix(mimeType, "image/") {
		if common.DebugEnabled {
			logger.LogDebug(c, "loadFromURL: decoding image config")
		}
		config, format, err := decodeImageConfig(fileBytes)
		if err == nil {
			cachedData.ImageConfig = &config
			cachedData.ImageFormat = format
			// 如果通过图片解码获取了更准确的格式，更新 MIME 类型
			if mimeType == "application/octet-stream" || mimeType == "" {
				cachedData.MimeType = "image/" + format
			}
		}
	}

	return cachedData, nil
}

// shouldUseDiskCache 判断是否应该使用磁盘缓存
func shouldUseDiskCache(dataSize int64) bool {
	return common.ShouldUseDiskCache(dataSize)
}

// writeToDiskCache 将数据写入磁盘缓存
func writeToDiskCache(base64Data string) (string, error) {
	return common.WriteDiskCacheFileString(common.DiskCacheTypeFile, base64Data)
}

// smartDetectMimeType 智能检测 MIME 类型
func smartDetectMimeType(resp *http.Response, url string, fileBytes []byte) string {
	// 1. 尝试从 Content-Type header 获取
	mimeType := resp.Header.Get("Content-Type")
	if idx := strings.Index(mimeType, ";"); idx != -1 {
		mimeType = strings.TrimSpace(mimeType[:idx])
	}
	if mimeType != "" && mimeType != "application/octet-stream" {
		return mimeType
	}

	// 2. 尝试从 Content-Disposition header 的 filename 获取
	if cd := resp.Header.Get("Content-Disposition"); cd != "" {
		parts := strings.Split(cd, ";")
		for _, part := range parts {
			part = strings.TrimSpace(part)
			if strings.HasPrefix(strings.ToLower(part), "filename=") {
				name := strings.TrimSpace(strings.TrimPrefix(part, "filename="))
				// 移除引号
				if len(name) > 2 && name[0] == '"' && name[len(name)-1] == '"' {
					name = name[1 : len(name)-1]
				}
				if dot := strings.LastIndex(name, "."); dot != -1 && dot+1 < len(name) {
					ext := strings.ToLower(name[dot+1:])
					if ext != "" {
						mt := GetMimeTypeByExtension(ext)
						if mt != "application/octet-stream" {
							return mt
						}
					}
				}
				break
			}
		}
	}

	// 3. 尝试从 URL 路径获取扩展名
	mt := guessMimeTypeFromURL(url)
	if mt != "application/octet-stream" {
		return mt
	}

	// 4. 使用 http.DetectContentType 内容嗅探
	if len(fileBytes) > 0 {
		sniffed := http.DetectContentType(fileBytes)
		if sniffed != "" && sniffed != "application/octet-stream" {
			// 去除可能的 charset 参数
			if idx := strings.Index(sniffed, ";"); idx != -1 {
				sniffed = strings.TrimSpace(sniffed[:idx])
			}
			return sniffed
		}
	}

	// 5. 尝试作为图片解码获取格式
	if len(fileBytes) > 0 {
		if _, format, err := decodeImageConfig(fileBytes); err == nil && format != "" {
			return "image/" + strings.ToLower(format)
		}
	}

	// 最终回退
	return "application/octet-stream"
}

// loadFromBase64 从 base64 字符串加载文件
func loadFromBase64(base64String string, providedMimeType string) (*types.CachedFileData, error) {
	var mimeType string
	var cleanBase64 string

	// 处理 data: 前缀
	if strings.HasPrefix(base64String, "data:") {
		idx := strings.Index(base64String, ",")
		if idx != -1 {
			header := base64String[:idx]
			cleanBase64 = base64String[idx+1:]

			if strings.Contains(header, ":") && strings.Contains(header, ";") {
				mimeStart := strings.Index(header, ":") + 1
				mimeEnd := strings.Index(header, ";")
				if mimeStart < mimeEnd {
					mimeType = header[mimeStart:mimeEnd]
				}
			}
		} else {
			cleanBase64 = base64String
		}
	} else {
		cleanBase64 = base64String
	}

	if providedMimeType != "" {
		mimeType = providedMimeType
	}

	decodedData, err := base64.StdEncoding.DecodeString(cleanBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64 data: %w", err)
	}

	base64Size := int64(len(cleanBase64))
	var cachedData *types.CachedFileData

	if shouldUseDiskCache(base64Size) {
		diskPath, err := writeToDiskCache(cleanBase64)
		if err != nil {
			cachedData = types.NewMemoryCachedData(cleanBase64, mimeType, int64(len(decodedData)))
		} else {
			cachedData = types.NewDiskCachedData(diskPath, mimeType, int64(len(decodedData)))
			cachedData.DiskSize = base64Size
			cachedData.OnClose = func(size int64) {
				common.DecrementDiskFiles(size)
			}
			common.IncrementDiskFiles(base64Size)
		}
	} else {
		cachedData = types.NewMemoryCachedData(cleanBase64, mimeType, int64(len(decodedData)))
	}

	if mimeType == "" || strings.HasPrefix(mimeType, "image/") {
		config, format, err := decodeImageConfig(decodedData)
		if err == nil {
			cachedData.ImageConfig = &config
			cachedData.ImageFormat = format
			if mimeType == "" {
				cachedData.MimeType = "image/" + format
			}
		}
	}

	return cachedData, nil
}

// GetImageConfig 获取图片配置
func GetImageConfig(c *gin.Context, source *types.FileSource) (image.Config, string, error) {
	cachedData, err := LoadFileSource(c, source, "get_image_config")
	if err != nil {
		return image.Config{}, "", err
	}

	if cachedData.ImageConfig != nil {
		return *cachedData.ImageConfig, cachedData.ImageFormat, nil
	}

	base64Str, err := cachedData.GetBase64Data()
	if err != nil {
		return image.Config{}, "", fmt.Errorf("failed to get base64 data: %w", err)
	}
	decodedData, err := base64.StdEncoding.DecodeString(base64Str)
	if err != nil {
		return image.Config{}, "", fmt.Errorf("failed to decode base64 for image config: %w", err)
	}

	config, format, err := decodeImageConfig(decodedData)
	if err != nil {
		return image.Config{}, "", err
	}

	cachedData.ImageConfig = &config
	cachedData.ImageFormat = format

	return config, format, nil
}

// GetBase64Data 获取 base64 编码的数据
func GetBase64Data(c *gin.Context, source *types.FileSource, reason ...string) (string, string, error) {
	cachedData, err := LoadFileSource(c, source, reason...)
	if err != nil {
		return "", "", err
	}
	base64Str, err := cachedData.GetBase64Data()
	if err != nil {
		return "", "", fmt.Errorf("failed to get base64 data: %w", err)
	}
	return base64Str, cachedData.MimeType, nil
}

// GetMimeType 获取文件的 MIME 类型
func GetMimeType(c *gin.Context, source *types.FileSource) (string, error) {
	if source.HasCache() {
		return source.GetCache().MimeType, nil
	}

	if source.IsURL() {
		mimeType, err := GetFileTypeFromUrl(c, source.URL, "get_mime_type")
		if err == nil && mimeType != "" && mimeType != "application/octet-stream" {
			return mimeType, nil
		}
	}

	cachedData, err := LoadFileSource(c, source, "get_mime_type")
	if err != nil {
		return "", err
	}
	return cachedData.MimeType, nil
}

// DetectFileType 检测文件类型
func DetectFileType(mimeType string) types.FileType {
	if strings.HasPrefix(mimeType, "image/") {
		return types.FileTypeImage
	}
	if strings.HasPrefix(mimeType, "audio/") {
		return types.FileTypeAudio
	}
	if strings.HasPrefix(mimeType, "video/") {
		return types.FileTypeVideo
	}
	return types.FileTypeFile
}

// decodeImageConfig 从字节数据解码图片配置
func decodeImageConfig(data []byte) (image.Config, string, error) {
	reader := bytes.NewReader(data)

	config, format, err := image.DecodeConfig(reader)
	if err == nil {
		return config, format, nil
	}

	reader.Seek(0, io.SeekStart)
	config, err = webp.DecodeConfig(reader)
	if err == nil {
		return config, "webp", nil
	}

	return image.Config{}, "", fmt.Errorf("failed to decode image config: unsupported format")
}

// guessMimeTypeFromURL 从 URL 猜测 MIME 类型
func guessMimeTypeFromURL(url string) string {
	cleanedURL := url
	if q := strings.Index(cleanedURL, "?"); q != -1 {
		cleanedURL = cleanedURL[:q]
	}

	if slash := strings.LastIndex(cleanedURL, "/"); slash != -1 && slash+1 < len(cleanedURL) {
		last := cleanedURL[slash+1:]
		if dot := strings.LastIndex(last, "."); dot != -1 && dot+1 < len(last) {
			ext := strings.ToLower(last[dot+1:])
			return GetMimeTypeByExtension(ext)
		}
	}

	return "application/octet-stream"
}
