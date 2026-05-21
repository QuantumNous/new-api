package service

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
)

const DrawingImageURLPrefix = "/pg/drawing/files/"

func PersistDrawingImageResults(images []dto.ImageData) ([]dto.ImageData, error) {
	result := make([]dto.ImageData, len(images))
	copy(result, images)

	for i := range result {
		rawImage := strings.TrimSpace(result[i].B64Json)
		if rawImage == "" && strings.HasPrefix(strings.TrimSpace(result[i].Url), "data:") {
			rawImage = result[i].Url
		}
		if rawImage != "" {
			url, err := SaveDrawingImage(rawImage)
			if err != nil {
				return nil, err
			}
			result[i].Url = url
			result[i].B64Json = ""
			continue
		}

		if isRemoteImageURL(result[i].Url) {
			url, err := SaveDrawingImageFromURL(result[i].Url)
			if err != nil {
				return nil, err
			}
			result[i].Url = url
		}
	}

	return result, nil
}

func SaveDrawingImage(base64Image string) (string, error) {
	data, mimeType, err := decodeDrawingImage(base64Image)
	if err != nil {
		return "", err
	}

	return saveDrawingImageBytes(data, mimeType)
}

func SaveDrawingImageFromURL(imageURL string) (string, error) {
	resp, err := DoDownloadRequest(imageURL, "persist_drawing_result")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download drawing image failed: HTTP %d", resp.StatusCode)
	}

	maxImageSize := int64(constant.MaxFileDownloadMB) * 1024 * 1024
	if maxImageSize <= 0 {
		maxImageSize = 64 * 1024 * 1024
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxImageSize+1))
	if err != nil {
		return "", fmt.Errorf("read drawing image failed: %w", err)
	}
	if int64(len(data)) > maxImageSize {
		return "", fmt.Errorf("drawing image size exceeds maximum allowed size: %dMB", constant.MaxFileDownloadMB)
	}

	mimeType := strings.ToLower(strings.TrimSpace(resp.Header.Get("Content-Type")))
	if idx := strings.Index(mimeType, ";"); idx != -1 {
		mimeType = mimeType[:idx]
	}
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = http.DetectContentType(data)
	}
	if !strings.HasPrefix(mimeType, "image/") {
		return "", fmt.Errorf("drawing result is not an image: %s", mimeType)
	}

	return saveDrawingImageBytes(data, mimeType)
}

func saveDrawingImageBytes(data []byte, mimeType string) (string, error) {
	mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	sum := sha256.Sum256(data)
	hash := hex.EncodeToString(sum[:])
	ext := imageExtFromMimeType(mimeType)
	if ext == "" {
		detectedMimeType := http.DetectContentType(data)
		ext = imageExtFromMimeType(detectedMimeType)
		mimeType = detectedMimeType
	}
	if ext == "" {
		return "", fmt.Errorf("unsupported drawing image type: %s", mimeType)
	}
	filename := hash + ext

	dir := GetDrawingImageStorageDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("create drawing image directory failed: %w", err)
	}

	path := filepath.Join(dir, filename)
	if _, err := os.Stat(path); err == nil {
		return DrawingImageURLPrefix + filename, nil
	} else if !os.IsNotExist(err) {
		return "", fmt.Errorf("stat drawing image failed: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return "", fmt.Errorf("write drawing image failed: %w", err)
	}

	return DrawingImageURLPrefix + filename, nil
}

func isRemoteImageURL(imageURL string) bool {
	imageURL = strings.ToLower(strings.TrimSpace(imageURL))
	return strings.HasPrefix(imageURL, "http://") || strings.HasPrefix(imageURL, "https://")
}

func GetDrawingImageStorageDir() string {
	return common.GetEnvOrDefaultString("DRAWING_IMAGE_STORAGE_PATH", "drawing-images")
}

func ResolveDrawingImagePath(filename string) (string, string, error) {
	if !isValidDrawingImageFilename(filename) {
		return "", "", fmt.Errorf("invalid drawing image filename")
	}
	mimeType := mimeTypeFromImageExt(filepath.Ext(filename))
	if mimeType == "" {
		return "", "", fmt.Errorf("unsupported drawing image type")
	}
	path := filepath.Join(GetDrawingImageStorageDir(), filename)
	return path, mimeType, nil
}

func decodeDrawingImage(raw string) ([]byte, string, error) {
	mimeType := ""
	dataPart := strings.TrimSpace(raw)
	if idx := strings.Index(dataPart, ","); idx != -1 && strings.HasPrefix(dataPart[:idx], "data:") {
		meta := dataPart[:idx]
		dataPart = dataPart[idx+1:]
		mimeType = parseDataURIMimeType(meta)
	}
	dataPart = strings.Map(func(r rune) rune {
		switch r {
		case '\r', '\n', '\t', ' ':
			return -1
		default:
			return r
		}
	}, dataPart)
	if dataPart == "" {
		return nil, "", fmt.Errorf("drawing image base64 is empty")
	}

	data, err := base64.StdEncoding.DecodeString(dataPart)
	if err != nil {
		data, err = base64.RawStdEncoding.DecodeString(dataPart)
	}
	if err != nil {
		return nil, "", fmt.Errorf("decode drawing image failed: %w", err)
	}

	if mimeType == "" {
		mimeType = http.DetectContentType(data)
	}
	if !strings.HasPrefix(mimeType, "image/") {
		return nil, "", fmt.Errorf("drawing result is not an image: %s", mimeType)
	}

	return data, mimeType, nil
}

func parseDataURIMimeType(meta string) string {
	meta = strings.TrimPrefix(meta, "data:")
	if idx := strings.Index(meta, ";"); idx != -1 {
		meta = meta[:idx]
	}
	return strings.ToLower(strings.TrimSpace(meta))
}

func imageExtFromMimeType(mimeType string) string {
	switch strings.ToLower(mimeType) {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ""
	}
}

func mimeTypeFromImageExt(ext string) string {
	switch strings.ToLower(ext) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	default:
		return ""
	}
}

func isValidDrawingImageFilename(filename string) bool {
	if filename != filepath.Base(filename) {
		return false
	}
	ext := strings.ToLower(filepath.Ext(filename))
	if mimeTypeFromImageExt(ext) == "" {
		return false
	}
	hash := strings.TrimSuffix(filename, ext)
	if len(hash) != sha256.Size*2 {
		return false
	}
	for _, r := range hash {
		if (r < '0' || r > '9') && (r < 'a' || r > 'f') {
			return false
		}
	}
	return true
}
