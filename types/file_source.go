package types

import (
	"fmt"
	"image"
	"os"
	"sync"
)

// FileSourceType 文件来源类型
type FileSourceType string

const (
	FileSourceTypeURL    FileSourceType = "url"    // URL 来源
	FileSourceTypeBase64 FileSourceType = "base64" // Base64 内联数据
)

// FileSource 统一的文件来源抽象
// 支持 URL 和 base64 两种来源，提供懒加载和缓存机制
type FileSource struct {
	Type       FileSourceType `json:"type"`                  // 来源类型
	URL        string         `json:"url,omitempty"`         // URL（当 Type 为 url 时）
	Base64Data string         `json:"base64_data,omitempty"` // Base64 数据（当 Type 为 base64 时）
	MimeType   string         `json:"mime_type,omitempty"`   // MIME 类型（可选，会自动检测）

	// 内部缓存（不导出，不序列化）
	cachedData  *CachedFileData
	cacheLoaded bool
	registered  bool       // 是否已注册到清理列表
	mu          sync.Mutex // 保护加载过程
}

// Mu 获取内部锁
func (f *FileSource) Mu() *sync.Mutex {
	return &f.mu
}

// CachedFileData 缓存的文件数据
// 支持内存缓存和磁盘缓存两种模式
type CachedFileData struct {
	base64Data  string        // 内存中的 base64 数据（小文件）
	MimeType    string        // MIME 类型
	Size        int64         // 文件大小（字节）
	DiskSize    int64         // 磁盘缓存实际占用大小（字节，通常是 base64 长度）
	ImageConfig *image.Config // 图片配置（如果是图片）
	ImageFormat string        // 图片格式（如果是图片）

	// 磁盘缓存相关
	diskPath        string     // 磁盘缓存文件路径（大文件）
	isDisk          bool       // 是否使用磁盘缓存
	diskMu          sync.Mutex // 磁盘操作锁（保护磁盘文件的读取和删除）
	diskClosed      bool       // 是否已关闭/清理
	statDecremented bool       // 是否已扣减统计

	// 统计回调，避免循环依赖
	OnClose func(size int64)
}

// NewMemoryCachedData 创建内存缓存的数据
func NewMemoryCachedData(base64Data string, mimeType string, size int64) *CachedFileData {
	return &CachedFileData{
		base64Data: base64Data,
		MimeType:   mimeType,
		Size:       size,
		isDisk:     false,
	}
}

// NewDiskCachedData 创建磁盘缓存的数据
func NewDiskCachedData(diskPath string, mimeType string, size int64) *CachedFileData {
	return &CachedFileData{
		diskPath: diskPath,
		MimeType: mimeType,
		Size:     size,
		isDisk:   true,
	}
}

// GetBase64Data 获取 base64 数据（自动处理内存/磁盘）
func (c *CachedFileData) GetBase64Data() (string, error) {
	if !c.isDisk {
		return c.base64Data, nil
	}

	c.diskMu.Lock()
	defer c.diskMu.Unlock()

	if c.diskClosed {
		return "", fmt.Errorf("disk cache already closed")
	}

	// 从磁盘读取
	data, err := os.ReadFile(c.diskPath)
	if err != nil {
		return "", fmt.Errorf("failed to read from disk cache: %w", err)
	}
	return string(data), nil
}

// SetBase64Data 设置 base64 数据（仅用于内存模式）
func (c *CachedFileData) SetBase64Data(data string) {
	if !c.isDisk {
		c.base64Data = data
	}
}

// IsDisk 是否使用磁盘缓存
func (c *CachedFileData) IsDisk() bool {
	return c.isDisk
}

// Close 关闭并清理资源
func (c *CachedFileData) Close() error {
	if !c.isDisk {
		c.base64Data = "" // 释放内存
		return nil
	}

	c.diskMu.Lock()
	defer c.diskMu.Unlock()

	if c.diskClosed {
		return nil
	}

	c.diskClosed = true
	if c.diskPath != "" {
		err := os.Remove(c.diskPath)
		// 只有在删除成功且未扣减过统计时，才执行回调
		if err == nil && !c.statDecremented && c.OnClose != nil {
			c.OnClose(c.DiskSize)
			c.statDecremented = true
		}
		return err
	}
	return nil
}

// NewURLFileSource 创建 URL 来源的 FileSource
func NewURLFileSource(url string) *FileSource {
	return &FileSource{
		Type: FileSourceTypeURL,
		URL:  url,
	}
}

// NewBase64FileSource 创建 base64 来源的 FileSource
func NewBase64FileSource(base64Data string, mimeType string) *FileSource {
	return &FileSource{
		Type:       FileSourceTypeBase64,
		Base64Data: base64Data,
		MimeType:   mimeType,
	}
}

// IsURL 判断是否是 URL 来源
func (f *FileSource) IsURL() bool {
	return f.Type == FileSourceTypeURL
}

// IsBase64 判断是否是 base64 来源
func (f *FileSource) IsBase64() bool {
	return f.Type == FileSourceTypeBase64
}

// GetIdentifier 获取文件标识符（用于日志和错误追踪）
func (f *FileSource) GetIdentifier() string {
	if f.IsURL() {
		if len(f.URL) > 100 {
			return f.URL[:100] + "..."
		}
		return f.URL
	}
	if len(f.Base64Data) > 50 {
		return "base64:" + f.Base64Data[:50] + "..."
	}
	return "base64:" + f.Base64Data
}

// GetRawData 获取原始数据（URL 或完整的 base64 字符串）
func (f *FileSource) GetRawData() string {
	if f.IsURL() {
		return f.URL
	}
	return f.Base64Data
}

// SetCache 设置缓存数据
func (f *FileSource) SetCache(data *CachedFileData) {
	f.cachedData = data
	f.cacheLoaded = true
}

// IsRegistered 是否已注册到清理列表
func (f *FileSource) IsRegistered() bool {
	return f.registered
}

// SetRegistered 设置注册状态
func (f *FileSource) SetRegistered(registered bool) {
	f.registered = registered
}

// GetCache 获取缓存数据
func (f *FileSource) GetCache() *CachedFileData {
	return f.cachedData
}

// HasCache 是否有缓存
func (f *FileSource) HasCache() bool {
	return f.cacheLoaded && f.cachedData != nil
}

// ClearCache 清除缓存，释放内存和磁盘文件
func (f *FileSource) ClearCache() {
	// 如果有缓存数据，先关闭它（会清理磁盘文件）
	if f.cachedData != nil {
		f.cachedData.Close()
	}
	f.cachedData = nil
	f.cacheLoaded = false
}

// ClearRawData 清除原始数据，只保留必要的元信息
// 用于在处理完成后释放大文件的内存
func (f *FileSource) ClearRawData() {
	// 保留 URL（通常很短），只清除大的 base64 数据
	if f.IsBase64() && len(f.Base64Data) > 1024 {
		f.Base64Data = ""
	}
}
