package xai

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
)

func TestConvertImageRequestBuildsMultipartForEditImage(t *testing.T) {
	adaptor := &Adaptor{}
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/images/edits", nil)

	converted, err := adaptor.ConvertImageRequest(ctx, &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesEdits,
	}, dto.ImageRequest{
		Model:          "grok-imagine-1.0-edit",
		Prompt:         "make it watercolor",
		N:              lo.ToPtr(uint(2)),
		Image:          []byte(`{"url":"data:image/png;base64,aGVsbG8="}`),
		Size:           "1024x1024",
		ResponseFormat: "url",
	})
	if err != nil {
		t.Fatalf("ConvertImageRequest returned error: %v", err)
	}

	payload, ok := converted.(map[string]any)
	if !ok {
		t.Fatalf("expected map[string]any, got %T", converted)
	}
	if payload["model"] != "grok-imagine-1.0-edit" {
		t.Fatalf("unexpected model: %v", payload["model"])
	}
	if payload["prompt"] != "make it watercolor" {
		t.Fatalf("unexpected prompt: %v", payload["prompt"])
	}
	if payload["n"] != uint(2) {
		t.Fatalf("unexpected n: %v", payload["n"])
	}
	if payload["response_format"] != "url" {
		t.Fatalf("unexpected response_format: %v", payload["response_format"])
	}
	image, ok := payload["image"].(map[string]any)
	if !ok {
		t.Fatalf("unexpected image payload: %#v", payload["image"])
	}
	if image["type"] != "image_url" {
		t.Fatalf("unexpected image type: %v", image["type"])
	}
	if image["url"] != "data:image/png;base64,aGVsbG8=" {
		t.Fatalf("unexpected image url: %v", image["url"])
	}
}

func TestConvertImageRequestPreservesSize(t *testing.T) {
	adaptor := &Adaptor{}

	converted, err := adaptor.ConvertImageRequest(nil, nil, dto.ImageRequest{
		Model:          "grok-imagine-1.0",
		Prompt:         "draw a city skyline",
		Size:           "1536x1024",
		ResponseFormat: "url",
	})
	if err != nil {
		t.Fatalf("ConvertImageRequest returned error: %v", err)
	}

	xaiReq, ok := converted.(ImageRequest)
	if !ok {
		t.Fatalf("expected xai.ImageRequest, got %T", converted)
	}
	if xaiReq.Size != "1536x1024" {
		t.Fatalf("unexpected size: %s", xaiReq.Size)
	}
}

func TestResolveImagePayloadSupportsPlainURLObject(t *testing.T) {
	filename, mimeType, content, err := resolveImagePayload([]byte(`{"url":"data:image/webp;base64,dGVzdA==","filename":"sample.webp"}`))
	if err != nil {
		t.Fatalf("resolveImagePayload returned error: %v", err)
	}
	if filename != "sample.webp" {
		t.Fatalf("unexpected filename: %s", filename)
	}
	if mimeType != "image/webp" {
		t.Fatalf("unexpected mime type: %s", mimeType)
	}
	if string(content) != "test" {
		t.Fatalf("unexpected content: %q", string(content))
	}
}

func TestModelListIncludesGrokImagineOnePointZeroVariants(t *testing.T) {
	expected := []string{
		"grok-imagine-1.0",
		"grok-imagine-1.0-fast",
		"grok-imagine-1.0-edit",
	}

	for _, model := range expected {
		if !lo.Contains(ModelList, model) {
			t.Fatalf("model list missing %s", model)
		}
	}
}
