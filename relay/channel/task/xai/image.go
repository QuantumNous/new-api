package xai

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

const maxGrokImageSize = 20 * 1024 * 1024 // 20 MB

// ExtractMultipartImageURL reads the first `input_reference` file from a multipart
// form upload and returns a URL usable by xAI ("https://..." or "data:image/...").
// Returns empty string if no file is present.
func ExtractMultipartImageURL(c *gin.Context, info *relaycommon.RelayInfo) string {
	mf, err := c.MultipartForm()
	if err != nil {
		return ""
	}
	files, exists := mf.File["input_reference"]
	if !exists || len(files) == 0 {
		return ""
	}
	fh := files[0]
	if fh.Size > maxGrokImageSize {
		return ""
	}
	file, err := fh.Open()
	if err != nil {
		return ""
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		return ""
	}

	mimeType := fh.Header.Get("Content-Type")
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = http.DetectContentType(fileBytes)
	}

	info.Action = constant.TaskActionGenerate
	return buildDataURL(mimeType, fileBytes)
}

// ParseImageURL parses an image string (http(s) URL, data URI or raw base64) into a
// URL usable by xAI ("https://..." or "data:image/..."). Returns empty string if invalid.
func ParseImageURL(imageStr string) string {
	imageStr = strings.TrimSpace(imageStr)
	if imageStr == "" {
		return ""
	}
	if strings.HasPrefix(imageStr, "data:") {
		return imageStr
	}
	if strings.HasPrefix(imageStr, "https://") || strings.HasPrefix(imageStr, "http://") {
		return imageStr
	}

	raw, err := decodeBase64(imageStr)
	if err != nil || len(raw) == 0 {
		return ""
	}
	if len(raw) > maxGrokImageSize {
		return ""
	}
	return buildDataURL(http.DetectContentType(raw), raw)
}

func decodeBase64(s string) ([]byte, error) {
	if b, err := base64.StdEncoding.DecodeString(s); err == nil {
		return b, nil
	}
	return base64.RawStdEncoding.DecodeString(s)
}

func buildDataURL(mimeType string, raw []byte) string {
	if strings.TrimSpace(mimeType) == "" {
		mimeType = "application/octet-stream"
	}
	return fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(raw))
}
