package types

import (
	"fmt"
	"image"
	"os"
	"strings"
	"sync"
)

// FileSource unified file source abstract interface
// Supports both URL and base64 sources, providing lazy loading and caching mechanisms
type FileSource interface {
	IsURL() bool
	GetIdentifier() string
	GetRawData() string
	ClearRawData()

	SetCache(data *CachedFileData)
	GetCache() *CachedFileData
	HasCache() bool
	ClearCache()

	IsRegistered() bool
	SetRegistered(registered bool)
	Mu() *sync.Mutex
}

// baseFileSource shared cache/lock/cleanup registration status
type baseFileSource struct {
	cachedData  *CachedFileData
	cacheLoaded bool
	registered  bool
	mu          sync.Mutex
}

func (b *baseFileSource) SetCache(data *CachedFileData) {
	b.cachedData = data
	b.cacheLoaded = true
}

func (b *baseFileSource) GetCache() *CachedFileData {
	return b.cachedData
}

func (b *baseFileSource) HasCache() bool {
	return b.cacheLoaded && b.cachedData != nil
}

func (b *baseFileSource) ClearCache() {
	if b.cachedData != nil {
		b.cachedData.Close()
	}
	b.cachedData = nil
	b.cacheLoaded = false
}

func (b *baseFileSource) IsRegistered() bool {
	return b.registered
}

func (b *baseFileSource) SetRegistered(registered bool) {
	b.registered = registered
}

func (b *baseFileSource) Mu() *sync.Mutex {
	return &b.mu
}

// ---------------------------------------------------------------------------
// URLSource — FileSource implementation of URL source
// ---------------------------------------------------------------------------

type URLSource struct {
	baseFileSource
	URL string
}

func (u *URLSource) IsURL() bool { return true }

func (u *URLSource) GetIdentifier() string {
	if len(u.URL) > 100 {
		return u.URL[:100] + "..."
	}
	return u.URL
}

func (u *URLSource) GetRawData() string { return u.URL }

func (u *URLSource) ClearRawData() {}

// ---------------------------------------------------------------------------
// Base64Source — FileSource implementation of the Base64 inline data source
// ---------------------------------------------------------------------------

type Base64Source struct {
	baseFileSource
	Base64Data string
	MimeType   string
}

func (b *Base64Source) IsURL() bool { return false }

func (b *Base64Source) GetIdentifier() string {
	if len(b.Base64Data) > 50 {
		return "base64:" + b.Base64Data[:50] + "..."
	}
	return "base64:" + b.Base64Data
}

func (b *Base64Source) GetRawData() string { return b.Base64Data }

func (b *Base64Source) ClearRawData() {
	if len(b.Base64Data) > 1024 {
		b.Base64Data = ""
	}
}

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

func NewURLFileSource(url string) *URLSource {
	return &URLSource{URL: url}
}

func NewBase64FileSource(base64Data string, mimeType string) *Base64Source {
	return &Base64Source{
		Base64Data: base64Data,
		MimeType:   mimeType,
	}
}

func NewFileSourceFromData(data string, mimeType string) FileSource {
	if strings.HasPrefix(data, "http://") || strings.HasPrefix(data, "https://") {
		return NewURLFileSource(data)
	}
	return NewBase64FileSource(data, mimeType)
}

// ---------------------------------------------------------------------------
// CachedFileData — cached file data (supports both memory and disk modes)
// ---------------------------------------------------------------------------

type CachedFileData struct {
	base64Data  string        // Base64 data in memory (small files)
	MimeType    string        // MIME type
	Size        int64         // File size (bytes)
	DiskSize    int64         // Actual disk cache size (bytes, usually base64 length)
	ImageConfig *image.Config // Picture configuration (if it is a picture)
	ImageFormat string        // Picture format (if it is a picture)

	diskPath        string     // Disk cache file path (large files)
	isDisk          bool       // Whether to use disk cache
	diskMu          sync.Mutex // Disk operation lock (protects the reading and deletion of disk files)
	diskClosed      bool       // Has it been closed/cleaned?
	statDecremented bool       // Whether statistics have been deducted

	OnClose func(size int64)
}

func NewMemoryCachedData(base64Data string, mimeType string, size int64) *CachedFileData {
	return &CachedFileData{
		base64Data: base64Data,
		MimeType:   mimeType,
		Size:       size,
		isDisk:     false,
	}
}

func NewDiskCachedData(diskPath string, mimeType string, size int64) *CachedFileData {
	return &CachedFileData{
		diskPath: diskPath,
		MimeType: mimeType,
		Size:     size,
		isDisk:   true,
	}
}

func (c *CachedFileData) GetBase64Data() (string, error) {
	if !c.isDisk {
		return c.base64Data, nil
	}

	c.diskMu.Lock()
	defer c.diskMu.Unlock()

	if c.diskClosed {
		return "", fmt.Errorf("disk cache already closed")
	}

	data, err := os.ReadFile(c.diskPath)
	if err != nil {
		return "", fmt.Errorf("failed to read from disk cache: %w", err)
	}
	return string(data), nil
}

func (c *CachedFileData) SetBase64Data(data string) {
	if !c.isDisk {
		c.base64Data = data
	}
}

func (c *CachedFileData) IsDisk() bool {
	return c.isDisk
}

func (c *CachedFileData) Close() error {
	if !c.isDisk {
		c.base64Data = ""
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
		if err == nil && !c.statDecremented && c.OnClose != nil {
			c.OnClose(c.DiskSize)
			c.statDecremented = true
		}
		return err
	}
	return nil
}
