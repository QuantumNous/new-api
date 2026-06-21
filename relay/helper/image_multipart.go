package helper

import (
	"encoding/base64"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
)

const maxPlaygroundImagePartBytes = 10 * 1024 * 1024

// ParseImageGenerationsMultipart reads POST multipart for /v1/images/generations(+ /async).
// Reference files are encoded as data-URI entries in ImageUrls for upstream JSON APIs.
func ParseImageGenerationsMultipart(c *gin.Context) (*dto.ImageRequest, error) {
	if !strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
		return nil, fmt.Errorf("expected multipart/form-data")
	}
	if _, err := c.MultipartForm(); err != nil {
		return nil, fmt.Errorf("failed to parse image generations form: %w", err)
	}
	form := c.Request.PostForm
	req := &dto.ImageRequest{
		Model:      strings.TrimSpace(form.Get("model")),
		Prompt:     strings.TrimSpace(form.Get("prompt")),
		Size:       strings.TrimSpace(form.Get("size")),
		Resolution: strings.TrimSpace(form.Get("resolution")),
		Quality:    strings.TrimSpace(form.Get("quality")),
	}
	if req.Model == "" {
		return nil, fmt.Errorf("model is required")
	}
	if req.Prompt == "" {
		return nil, fmt.Errorf("prompt is required")
	}
	if n := common.String2Int(form.Get("n")); n > 0 {
		req.N = common.GetPointer(uint(n))
	} else {
		req.N = common.GetPointer(uint(1))
	}

	urls, err := imageDataURIsFromMultipart(c.Request.MultipartForm)
	if err != nil {
		return nil, err
	}
	if len(urls) > 0 {
		req.ImageUrls = urls
	}
	return req, nil
}

func imageDataURIsFromMultipart(mf *multipart.Form) ([]string, error) {
	if mf == nil || mf.File == nil {
		return nil, nil
	}
	var headers []*multipart.FileHeader
	for _, key := range []string{"images", "image", "image[]"} {
		if files, ok := mf.File[key]; ok {
			headers = append(headers, files...)
		}
	}
	for field, files := range mf.File {
		if strings.HasPrefix(field, "image[") {
			headers = append(headers, files...)
		}
	}
	if len(headers) == 0 {
		return nil, nil
	}

	out := make([]string, 0, len(headers))
	for i, fh := range headers {
		if fh == nil || fh.Size <= 0 {
			continue
		}
		if fh.Size > maxPlaygroundImagePartBytes {
			return nil, fmt.Errorf("image %d too large (max 10MB)", i+1)
		}
		f, err := fh.Open()
		if err != nil {
			return nil, fmt.Errorf("open image %d: %w", i+1, err)
		}
		data, err := io.ReadAll(io.LimitReader(f, maxPlaygroundImagePartBytes+1))
		_ = f.Close()
		if err != nil {
			return nil, fmt.Errorf("read image %d: %w", i+1, err)
		}
		if len(data) > maxPlaygroundImagePartBytes {
			return nil, fmt.Errorf("image %d too large (max 10MB)", i+1)
		}
		mime := fh.Header.Get("Content-Type")
		if mime == "" {
			mime = http.DetectContentType(data)
		}
		if !strings.HasPrefix(mime, "image/") {
			mime = "image/png"
		}
		out = append(out, fmt.Sprintf("data:%s;base64,%s", mime, base64.StdEncoding.EncodeToString(data)))
	}
	return out, nil
}
