package service

import (
	"encoding/base64"
	"fmt"
	"io"
	"one-api/common"
	"one-api/constant"
	"one-api/dto"
	"strings"
)

func GetFileBase64FromUrl(url string) (*dto.LocalFileData, error) {
	var maxFileSize = constant.MaxFileDownloadMB * 1024 * 1024

	resp, err := DoDownloadRequest(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Always use LimitReader to prevent oversized downloads
	fileBytes, err := io.ReadAll(io.LimitReader(resp.Body, int64(maxFileSize+1)))
	if err != nil {
		return nil, err
	}
	// Check actual size after reading
	if len(fileBytes) > maxFileSize {
		return nil, fmt.Errorf("file size exceeds maximum allowed size: %dMB", constant.MaxFileDownloadMB)
	}

	// Convert to base64
	base64Data := base64.StdEncoding.EncodeToString(fileBytes)

	mimeType := resp.Header.Get("Content-Type")
	if len(strings.Split(mimeType, ";")) > 1 {
		// If Content-Type has parameters, take the first part
		mimeType = strings.Split(mimeType, ";")[0]
	}
	if mimeType == "application/octet-stream" {
		if common.DebugEnabled {
			println("MIME type is application/octet-stream, trying to guess from URL or filename")
		}
		// try to guess the MIME type from the url last segment
		urlParts := strings.Split(url, "/")
		if len(urlParts) > 0 {
			lastSegment := urlParts[len(urlParts)-1]
			if strings.Contains(lastSegment, ".") {
				// Extract the file extension
				filename := strings.Split(lastSegment, ".")
				if len(filename) > 1 {
					ext := strings.ToLower(filename[len(filename)-1])
					// Guess MIME type based on file extension
					mimeType = GetMimeTypeByExtension(ext)
				}
			}
		} else {
			// try to guess the MIME type from the file extension
			fileName := resp.Header.Get("Content-Disposition")
			if fileName != "" {
				// Extract the filename from the Content-Disposition header
				parts := strings.Split(fileName, ";")
				for _, part := range parts {
					if strings.HasPrefix(strings.TrimSpace(part), "filename=") {
						fileName = strings.TrimSpace(strings.TrimPrefix(part, "filename="))
						// Remove quotes if present
						if len(fileName) > 2 && fileName[0] == '"' && fileName[len(fileName)-1] == '"' {
							fileName = fileName[1 : len(fileName)-1]
						}
						// Guess MIME type based on file extension
						if ext := strings.ToLower(strings.TrimPrefix(fileName, ".")); ext != "" {
							mimeType = GetMimeTypeByExtension(ext)
						}
						break
					}
				}
			}
		}
	}

	return &dto.LocalFileData{
		Base64Data: base64Data,
		MimeType:   mimeType,
		Size:       int64(len(fileBytes)),
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
