package xai

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/samber/lo"
)

func TestConvertImageRequestPreservesEditImage(t *testing.T) {
	adaptor := &Adaptor{}
	image := json.RawMessage(`{"url":"https://example.com/source.png"}`)

	converted, err := adaptor.ConvertImageRequest(nil, nil, dto.ImageRequest{
		Model:          "grok-imagine-1.0-edit",
		Prompt:         "make it watercolor",
		N:              lo.ToPtr(uint(2)),
		Image:          image,
		ResponseFormat: "url",
	})
	if err != nil {
		t.Fatalf("ConvertImageRequest returned error: %v", err)
	}

	xaiReq, ok := converted.(ImageRequest)
	if !ok {
		t.Fatalf("expected xai.ImageRequest, got %T", converted)
	}
	if xaiReq.Model != "grok-imagine-1.0-edit" {
		t.Fatalf("unexpected model: %s", xaiReq.Model)
	}
	if xaiReq.N != 2 {
		t.Fatalf("unexpected n: %d", xaiReq.N)
	}
	if xaiReq.ResponseFormat != "url" {
		t.Fatalf("unexpected response_format: %s", xaiReq.ResponseFormat)
	}
	gotImage, ok := xaiReq.Image.(json.RawMessage)
	if !ok {
		t.Fatalf("expected json.RawMessage image, got %T", xaiReq.Image)
	}
	if string(gotImage) != string(image) {
		t.Fatalf("unexpected image payload: %s", string(gotImage))
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
