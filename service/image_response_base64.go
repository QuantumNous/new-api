package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/tidwall/gjson"
)

// Batch workers spool upstream responses privately so storage recovery can reuse
// an image URL without repeating a billable generation request.
const DrawingResponseSpoolContextKey = "server_drawing_response_spool"

// EnsureImageBase64Response makes URL-only images usable by Base64-only clients.
// Native nonempty Base64 payloads are preserved without a second download.
func EnsureImageBase64Response(ctx context.Context, body []byte) ([]byte, error) {
	data := gjson.GetBytes(body, "data")
	if !data.IsArray() {
		return nil, errors.New("upstream returned an invalid image list")
	}
	items := data.Array()
	if len(items) > dto.MaxImageN {
		return nil, errors.New("upstream returned too many images")
	}
	remaining := MaxDrawingResponseBytes
	needsConversion := false
	for _, item := range items {
		if !item.IsObject() {
			return nil, errors.New("upstream returned an invalid image item")
		}
		encoded := item.Get("b64_json")
		if encoded.Type == gjson.String && encoded.Str != "" {
			remaining -= int64(len(encoded.Str))
		} else {
			needsConversion = true
		}
	}
	if !needsConversion {
		return body, nil
	}
	if remaining <= 0 {
		return nil, errors.New("converted image response exceeds the Base64 size limit")
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	var response map[string]json.RawMessage
	var images []map[string]json.RawMessage
	if common.Unmarshal(body, &response) != nil || common.Unmarshal(response["data"], &images) != nil {
		return nil, errors.New("invalid image response")
	}
	for index, item := range images {
		var encoded, location string
		_ = common.Unmarshal(item["b64_json"], &encoded)
		if encoded != "" {
			continue
		}
		_ = common.Unmarshal(item["url"], &location)
		limit := min(MaxDrawingBytes, remaining/4*3)
		if limit <= 0 {
			return nil, errors.New("converted image response exceeds the Base64 size limit")
		}
		imageBytes, err := downloadImageForBase64(ctx, location, limit)
		if err != nil {
			return nil, fmt.Errorf("image %d: %w", index+1, err)
		}
		encoded = base64.StdEncoding.EncodeToString(imageBytes)
		remaining -= int64(len(encoded))
		item["b64_json"], err = common.Marshal(encoded)
		if err != nil {
			return nil, errors.New("failed to encode downloaded image")
		}
	}
	var err error
	response["data"], err = common.Marshal(images)
	if err != nil {
		return nil, errors.New("failed to encode image response")
	}
	return common.Marshal(response)
}

func downloadImageForBase64(ctx context.Context, location string, limit int64) ([]byte, error) {
	if ctx.Err() != nil {
		return nil, errors.New("image download cancelled or timed out")
	}
	if location == "" {
		return nil, errors.New("upstream returned neither Base64 nor an image URL")
	}
	response, err := requestImageResponse(ctx, location, false)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("image download returned HTTP %d", response.StatusCode)
	}
	if response.ContentLength > limit {
		return nil, errors.New("image download exceeds the size limit")
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if err != nil {
		return nil, errors.New("image download was incomplete")
	}
	if int64(len(data)) > limit {
		return nil, errors.New("image download exceeds the size limit")
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 {
		return nil, errors.New("downloaded content is not a supported image")
	}
	return data, nil
}
