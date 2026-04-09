package service

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"net/url"
	"os"
	"path"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/dto"
)

type CreativeCenterAssetArchiveResult struct {
	FilePath     string
	DownloadName string
	SuccessCount int
	FailureCount int
}

func CreateCreativeCenterAssetArchive(assets []*dto.CreativeCenterAsset, baseURL string) (*CreativeCenterAssetArchiveResult, error) {
	tempFile, err := os.CreateTemp("", "creative-center-assets-*.zip")
	if err != nil {
		return nil, err
	}

	cleanupOnError := func(originalErr error) (*CreativeCenterAssetArchiveResult, error) {
		_ = tempFile.Close()
		_ = os.Remove(tempFile.Name())
		return nil, originalErr
	}

	zipWriter := zip.NewWriter(tempFile)
	nameCounter := make(map[string]int)
	failures := make([]string, 0)
	successCount := 0

	for index, asset := range assets {
		content, ext, err := fetchCreativeCenterAssetContent(asset, baseURL)
		if err != nil {
			failures = append(failures, fmt.Sprintf("%s: %s", asset.AssetID, err.Error()))
			continue
		}

		fileName := uniqueArchiveFileName(nameCounter, buildCreativeCenterAssetFileName(asset, index, ext))
		writer, err := zipWriter.Create(fileName)
		if err != nil {
			return cleanupOnError(err)
		}
		if _, err = writer.Write(content); err != nil {
			return cleanupOnError(err)
		}
		successCount++
	}

	if len(failures) > 0 {
		writer, err := zipWriter.Create("failed-assets.txt")
		if err != nil {
			return cleanupOnError(err)
		}
		if _, err = writer.Write([]byte(strings.Join(failures, "\n"))); err != nil {
			return cleanupOnError(err)
		}
	}

	if err = zipWriter.Close(); err != nil {
		return cleanupOnError(err)
	}
	if err = tempFile.Close(); err != nil {
		return cleanupOnError(err)
	}

	if successCount == 0 {
		_ = os.Remove(tempFile.Name())
		return nil, fmt.Errorf("no downloadable assets available")
	}

	return &CreativeCenterAssetArchiveResult{
		FilePath:     tempFile.Name(),
		DownloadName: fmt.Sprintf("creative-center-assets-%s.zip", time.Now().Format("20060102-150405")),
		SuccessCount: successCount,
		FailureCount: len(failures),
	}, nil
}

func fetchCreativeCenterAssetContent(asset *dto.CreativeCenterAsset, baseURL string) ([]byte, string, error) {
	mediaURL := strings.TrimSpace(asset.MediaURL)
	if mediaURL == "" {
		return nil, "", fmt.Errorf("media url is empty")
	}

	if strings.HasPrefix(mediaURL, "data:") {
		return decodeCreativeCenterAssetDataURL(mediaURL)
	}

	resolvedURL := resolveCreativeCenterAssetURL(mediaURL, baseURL)
	resp, err := DoDownloadRequest(resolvedURL, "creative_center_asset_zip")
	if err != nil {
		return nil, "", err
	}
	defer CloseResponseBodyGracefully(resp)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("download failed with status %d", resp.StatusCode)
	}

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}

	ext := extensionFromURL(resolvedURL)
	if ext == "" {
		ext = extensionFromContentType(resp.Header.Get("Content-Type"), asset.AssetType)
	}

	return content, ext, nil
}

func decodeCreativeCenterAssetDataURL(dataURL string) ([]byte, string, error) {
	commaIndex := strings.Index(dataURL, ",")
	if commaIndex < 0 {
		return nil, "", fmt.Errorf("invalid data url")
	}

	meta := dataURL[:commaIndex]
	payload := dataURL[commaIndex+1:]
	if !strings.HasSuffix(meta, ";base64") {
		return nil, "", fmt.Errorf("unsupported data url encoding")
	}

	content, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return nil, "", err
	}

	ext := extensionFromContentType(strings.TrimPrefix(strings.TrimSuffix(meta, ";base64"), "data:"), "")
	return content, ext, nil
}

func resolveCreativeCenterAssetURL(rawURL string, baseURL string) string {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return ""
	}
	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
		return trimmed
	}
	if strings.TrimSpace(baseURL) == "" {
		return trimmed
	}

	base, err := url.Parse(baseURL)
	if err != nil {
		return trimmed
	}
	ref, err := url.Parse(trimmed)
	if err != nil {
		return trimmed
	}
	return base.ResolveReference(ref).String()
}

func buildCreativeCenterAssetFileName(asset *dto.CreativeCenterAsset, index int, ext string) string {
	normalizedExt := strings.TrimPrefix(strings.TrimSpace(ext), ".")
	if normalizedExt == "" {
		if asset.AssetType == "video" {
			normalizedExt = "mp4"
		} else {
			normalizedExt = "png"
		}
	}

	sessionName := sanitizeArchiveSegment(asset.SessionName)
	if sessionName == "" {
		sessionName = sanitizeArchiveSegment(asset.TaskID)
	}
	if sessionName == "" {
		sessionName = "task"
	}

	modelName := sanitizeArchiveSegment(asset.ModelName)
	if modelName == "" {
		modelName = asset.AssetType
	}

	return fmt.Sprintf("%s-%s-%s-%d.%s", asset.AssetType, modelName, sessionName, index+1, normalizedExt)
}

func sanitizeArchiveSegment(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return ""
	}

	var builder strings.Builder
	for _, char := range trimmed {
		switch {
		case char >= 'a' && char <= 'z':
			builder.WriteRune(char)
		case char >= '0' && char <= '9':
			builder.WriteRune(char)
		case char == '-' || char == '_':
			builder.WriteRune(char)
		case char == ' ' || char == '/' || char == '\\':
			builder.WriteRune('-')
		}
	}

	result := strings.Trim(builder.String(), "-_")
	if result == "" {
		return ""
	}
	return result
}

func uniqueArchiveFileName(counter map[string]int, baseName string) string {
	if counter[baseName] == 0 {
		counter[baseName] = 1
		return baseName
	}

	counter[baseName]++
	ext := path.Ext(baseName)
	name := strings.TrimSuffix(baseName, ext)
	return fmt.Sprintf("%s-%d%s", name, counter[baseName], ext)
}

func extensionFromURL(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	ext := strings.TrimPrefix(path.Ext(parsed.Path), ".")
	if ext == "" {
		return ""
	}
	return strings.ToLower(ext)
}

func extensionFromContentType(contentType string, assetType string) string {
	contentType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	switch contentType {
	case "image/png":
		return "png"
	case "image/jpeg":
		return "jpg"
	case "image/webp":
		return "webp"
	case "image/gif":
		return "gif"
	case "video/mp4":
		return "mp4"
	case "video/webm":
		return "webm"
	case "video/quicktime":
		return "mov"
	}

	if assetType == "video" {
		return "mp4"
	}
	if assetType == "image" {
		return "png"
	}
	return ""
}

func ReadCreativeCenterArchiveFile(filePath string) ([]byte, error) {
	return os.ReadFile(filePath)
}

func CleanupCreativeCenterArchiveFile(filePath string) {
	if strings.TrimSpace(filePath) == "" {
		return
	}
	_ = os.Remove(filePath)
}

func BlobFromBytes(payload []byte) io.Reader {
	return bytes.NewReader(payload)
}
