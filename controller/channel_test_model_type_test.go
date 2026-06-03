package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

func TestBuildTestRequestAutoVolcSeedreamUsesImageRequest(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeVolcEngine}
	req := buildTestRequest("doubao-seedream-4-5-251128", "", ch, false)
	img, ok := req.(*dto.ImageRequest)
	if !ok {
		t.Fatalf("buildTestRequest returned %T, want *dto.ImageRequest", req)
	}
	if img.Size != "2K" {
		t.Fatalf("seedream image test size = %q, want 2K", img.Size)
	}
}

func TestBuildImageTestRequestUsesOpenAICompatibleDefaultSize(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeOpenAI}
	req := buildImageTestRequest("gpt-image-1", ch)
	if req.Size != "1024x1024" {
		t.Fatalf("openai image test size = %q, want 1024x1024", req.Size)
	}
}

func TestEndpointTypeFromModelType(t *testing.T) {
	cases := map[string]constant.EndpointType{
		model.ModelTypeText:      constant.EndpointTypeOpenAI,
		model.ModelTypeEmbedding: constant.EndpointTypeEmbeddings,
		model.ModelTypeImage:     constant.EndpointTypeImageGeneration,
		model.ModelTypeFile:      constant.EndpointTypeOpenAIResponse,
		model.ModelTypeAudio:     constant.EndpointTypeOpenAI,
		model.ModelTypeVideo:     constant.EndpointTypeOpenAI,
	}
	for modelType, want := range cases {
		got := endpointTypeFromModelType(modelType)
		if got != want {
			t.Fatalf("endpointTypeFromModelType(%q) = %q, want %q", modelType, got, want)
		}
	}
}
