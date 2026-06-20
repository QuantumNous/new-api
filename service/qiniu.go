package service

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"

	"github.com/gin-gonic/gin"
	"github.com/qiniu/go-sdk/v7/auth/qbox"
	"github.com/qiniu/go-sdk/v7/storage"
)

// UploadImageToQiniu uploads image bytes to Qiniu CDN and returns the public URL.
// Path format: /image/{YYYY-MM}/{md5}.{ext}
func UploadImageToQiniu(imageBytes []byte, ext string) (string, error) {
	if common.QiniuAccessKey == "" || common.QiniuSecretKey == "" || common.QiniuBucket == "" {
		return "", fmt.Errorf("qiniu credentials not configured")
	}

	// Build CDN path
	hash := md5.Sum(imageBytes)
	month := time.Now().Format("2006-01")
	key := fmt.Sprintf("image/%s/%x.%s", month, hash, ext)

	// Put policy: 30-day expiry (images are immutable by content hash)
	putPolicy := storage.PutPolicy{
		Scope:   common.QiniuBucket + ":" + key,
		Expires: 3600 * 24 * 30,
	}
	mac := qbox.NewMac(common.QiniuAccessKey, common.QiniuSecretKey)
	uploadToken := putPolicy.UploadToken(mac)

	// Use PutUploader for in-memory data
	cfg := storage.Config{
		UseHTTPS: true,
	}
	formUploader := storage.NewFormUploader(&cfg)
	ret := storage.PutRet{}

	err := formUploader.Put(context.Background(), &ret, uploadToken, key, bytes.NewReader(imageBytes), int64(len(imageBytes)), nil)
	if err != nil {
		return "", fmt.Errorf("qiniu upload failed: %w", err)
	}

	cdnURL := fmt.Sprintf("https://%s/%s", common.QiniuCDNDomain, key)
	return cdnURL, nil
}

// ProcessImageResponseCDN processes an OpenAI image response, uploading images
// to Qiniu CDN and rewriting URLs. Handles both url and b64_json fields.
// Returns modified JSON bytes. Non-fatal on individual image failures.
func ProcessImageResponseCDN(c *gin.Context, responseBody []byte) ([]byte, error) {
	var imgResp dto.ImageResponse
	if err := common.Unmarshal(responseBody, &imgResp); err != nil {
		return responseBody, fmt.Errorf("unmarshal image response: %w", err)
	}

	cdnPrefix := fmt.Sprintf("https://%s/", common.QiniuCDNDomain)
	changed := false

	for i, img := range imgResp.Data {
		if img.Url != "" {
			// Skip if already on our CDN
			if strings.HasPrefix(img.Url, cdnPrefix) {
				continue
			}
			// Download the image from upstream URL
			imageBytes, ext, err := downloadImage(img.Url)
			if err != nil {
				logger.LogWarn(c, fmt.Sprintf("CDN: failed to download image %d: %s", i, err.Error()))
				continue
			}
			cdnURL, err := UploadImageToQiniu(imageBytes, ext)
			if err != nil {
				logger.LogWarn(c, fmt.Sprintf("CDN: failed to upload image %d: %s", i, err.Error()))
				continue
			}
			imgResp.Data[i].Url = cdnURL
			imgResp.Data[i].B64Json = ""
			changed = true
		} else if img.B64Json != "" {
			// Decode base64, detect format, upload
			imageBytes, ext, err := decodeBase64Image(img.B64Json)
			if err != nil {
				logger.LogWarn(c, fmt.Sprintf("CDN: failed to decode b64 image %d: %s", i, err.Error()))
				continue
			}
			cdnURL, err := UploadImageToQiniu(imageBytes, ext)
			if err != nil {
				logger.LogWarn(c, fmt.Sprintf("CDN: failed to upload b64 image %d: %s", i, err.Error()))
				continue
			}
			imgResp.Data[i].Url = cdnURL
			imgResp.Data[i].B64Json = ""
			changed = true
		}
	}

	if !changed {
		return responseBody, nil
	}

	processed, err := common.Marshal(imgResp)
	if err != nil {
		return responseBody, fmt.Errorf("marshal processed response: %w", err)
	}
	return processed, nil
}

// downloadImage downloads an image URL and returns the bytes and detected extension.
func downloadImage(url string) ([]byte, string, error) {
	resp, err := httpGetWithTimeout(url, 30*time.Second)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}

	ext := detectImageExt(resp.Header.Get("Content-Type"), body)
	return body, ext, nil
}

// decodeBase64Image decodes a base64 image string (with or without data-URL prefix)
// and returns the raw bytes and detected extension.
func decodeBase64Image(b64 string) ([]byte, string, error) {
	// Strip data-URL prefix if present
	if idx := strings.Index(b64, ","); idx != -1 {
		b64 = b64[idx+1:]
	}
	data, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return nil, "", fmt.Errorf("base64 decode: %w", err)
	}
	ext := detectImageExt("", data)
	return data, ext, nil
}

// detectImageExt returns a file extension based on Content-Type header or magic bytes.
func detectImageExt(contentType string, data []byte) string {
	ct := strings.ToLower(contentType)
	switch {
	case strings.Contains(ct, "png"):
		return "png"
	case strings.Contains(ct, "jpeg") || strings.Contains(ct, "jpg"):
		return "jpg"
	case strings.Contains(ct, "webp"):
		return "webp"
	case strings.Contains(ct, "gif"):
		return "gif"
	}
	// Fallback: magic bytes
	if len(data) >= 8 {
		if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
			return "png" // PNG
		}
		if data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
			return "jpg" // JPEG
		}
		if string(data[8:12]) == "WEBP" {
			return "webp"
		}
		if data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46 {
			return "gif"
		}
	}
	return "png" // default
}

func httpGetWithTimeout(url string, timeout time.Duration) (*http.Response, error) {
	client := &http.Client{Timeout: timeout}
	return client.Get(url)
}
