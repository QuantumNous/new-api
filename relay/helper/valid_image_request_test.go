package helper

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
)

func newImageGenerationContext(t *testing.T, body map[string]any) *gin.Context {
	t.Helper()

	payload, err := common.Marshal(body)
	if err != nil {
		t.Fatalf("common.Marshal returned error: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/images/generations",
		strings.NewReader(string(payload)),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx
}

func TestGetAndValidOpenAIImageRequestAcceptsGPTImage2Options(t *testing.T) {
	gin.SetMode(gin.TestMode)

	ctx := newImageGenerationContext(t, map[string]any{
		"model":         "gpt-image-2",
		"prompt":        "a clean product photo",
		"size":          "3840x2160",
		"quality":       "high",
		"output_format": "webp",
	})

	request, err := GetAndValidOpenAIImageRequest(ctx, relayconstant.RelayModeImagesGenerations)
	if err != nil {
		t.Fatalf("GetAndValidOpenAIImageRequest returned error: %v", err)
	}
	if request.Model != "gpt-image-2" {
		t.Fatalf("model = %q, want gpt-image-2", request.Model)
	}
	if request.Size != "3840x2160" {
		t.Fatalf("size = %q, want 3840x2160", request.Size)
	}
}

func TestGetAndValidOpenAIImageRequestRejectsGPTImage2InvalidSize(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name string
		size string
	}{
		{name: "not divisible by 16", size: "1025x1024"},
		{name: "aspect ratio too wide", size: "3840x1024"},
		{name: "too many pixels", size: "3840x3840"},
		{name: "too large", size: "4096x2160"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := newImageGenerationContext(t, map[string]any{
				"model":  "gpt-image-2",
				"prompt": "a clean product photo",
				"size":   tt.size,
			})

			if _, err := GetAndValidOpenAIImageRequest(ctx, relayconstant.RelayModeImagesGenerations); err == nil {
				t.Fatal("GetAndValidOpenAIImageRequest returned nil error")
			}
		})
	}
}

func TestGetAndValidOpenAIImageRequestRejectsGPTImage2InvalidOutputFormat(t *testing.T) {
	gin.SetMode(gin.TestMode)

	ctx := newImageGenerationContext(t, map[string]any{
		"model":         "gpt-image-2",
		"prompt":        "a clean product photo",
		"size":          "1024x1024",
		"output_format": "gif",
	})

	if _, err := GetAndValidOpenAIImageRequest(ctx, relayconstant.RelayModeImagesGenerations); err == nil {
		t.Fatal("GetAndValidOpenAIImageRequest returned nil error")
	}
}
