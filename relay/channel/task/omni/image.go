package omni

import (
	"encoding/base64"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const maxInlineImageBytes = 20 * 1024 * 1024

var supportedImageMimeTypes = map[string]struct{}{
	"image/heic": {},
	"image/heif": {},
	"image/jpeg": {},
	"image/png":  {},
	"image/webp": {},
}

func multipartImageCount(c *gin.Context) int {
	form, err := c.MultipartForm()
	if err != nil || form == nil {
		return 0
	}
	count := 0
	for _, field := range []string{"input_reference", "image", "images"} {
		count += len(form.File[field])
	}
	return count
}

func collectImageParts(c *gin.Context, images []string) ([]inputPart, error) {
	parts := make([]inputPart, 0, len(images)+multipartImageCount(c))
	form, err := c.MultipartForm()
	if err == nil && form != nil {
		for _, field := range []string{"input_reference", "image", "images"} {
			for _, fileHeader := range form.File[field] {
				part, err := imagePartFromMultipart(fileHeader)
				if err != nil {
					return nil, fmt.Errorf("invalid %s image: %w", field, err)
				}
				parts = append(parts, part)
			}
		}
	}
	for index, image := range images {
		part, err := imagePartFromString(image)
		if err != nil {
			return nil, fmt.Errorf("invalid image %d: %w", index, err)
		}
		parts = append(parts, part)
	}
	if len(parts) > MaxImages {
		return nil, fmt.Errorf("images must contain at most %d items", MaxImages)
	}
	return parts, nil
}

func imagePartFromMultipart(fileHeader *multipart.FileHeader) (inputPart, error) {
	if fileHeader == nil {
		return inputPart{}, fmt.Errorf("file is required")
	}
	if fileHeader.Size <= 0 || fileHeader.Size > maxInlineImageBytes {
		return inputPart{}, fmt.Errorf("file size must be between 1 and %d bytes", maxInlineImageBytes)
	}
	file, err := fileHeader.Open()
	if err != nil {
		return inputPart{}, err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxInlineImageBytes+1))
	if err != nil {
		return inputPart{}, err
	}
	if len(data) == 0 || len(data) > maxInlineImageBytes {
		return inputPart{}, fmt.Errorf("file size must be between 1 and %d bytes", maxInlineImageBytes)
	}
	mimeType := strings.TrimSpace(fileHeader.Header.Get("Content-Type"))
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = http.DetectContentType(data)
	}
	return newInlineImagePart(mimeType, base64.StdEncoding.EncodeToString(data))
}

func imagePartFromString(value string) (inputPart, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return inputPart{}, fmt.Errorf("image is required")
	}
	if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
		mimeType, data, err := service.GetImageFromUrl(value)
		if err != nil {
			return inputPart{}, err
		}
		return newInlineImagePart(mimeType, data)
	}
	if strings.HasPrefix(value, "data:") {
		comma := strings.Index(value, ",")
		if comma < 0 {
			return inputPart{}, fmt.Errorf("invalid data URI")
		}
		metadata := value[len("data:"):comma]
		if !strings.HasSuffix(metadata, ";base64") {
			return inputPart{}, fmt.Errorf("image data URI must use base64 encoding")
		}
		return newInlineImagePart(strings.TrimSuffix(metadata, ";base64"), value[comma+1:])
	}
	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return inputPart{}, fmt.Errorf("image must be an HTTP URL, data URI, or raw base64")
	}
	return newInlineImagePart(http.DetectContentType(decoded), value)
}

func newInlineImagePart(mimeType string, data string) (inputPart, error) {
	mimeType = strings.TrimSpace(strings.SplitN(mimeType, ";", 2)[0])
	if _, ok := supportedImageMimeTypes[mimeType]; !ok {
		return inputPart{}, fmt.Errorf("unsupported image MIME type %q", mimeType)
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(data))
	if err != nil {
		return inputPart{}, fmt.Errorf("invalid base64 image data")
	}
	if len(decoded) == 0 || len(decoded) > maxInlineImageBytes {
		return inputPart{}, fmt.Errorf("decoded image size must be between 1 and %d bytes", maxInlineImageBytes)
	}
	return inputPart{
		Type:     "image",
		MimeType: mimeType,
		Data:     strings.TrimSpace(data),
	}, nil
}
