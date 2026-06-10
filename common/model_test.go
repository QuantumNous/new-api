package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestIsImageGenerationModelIncludesConfiguredImageModels(t *testing.T) {
	models := []string{
		"gpt-image-2(线路XF)",
		"gr-image-2",
		"gemini-2.5-flash-image",
		"gemini-2.5-flash-image-preview",
		"gemini-3-pro-image-preview",
		"gemini-3.1-flash-image-preview",
		"nano-banana",
		"nano-banana-hd",
		"nano-banana-pro",
	}

	for _, model := range models {
		t.Run(model, func(t *testing.T) {
			if !IsImageGenerationModel(model) {
				t.Fatalf("IsImageGenerationModel(%q) = false, want true", model)
			}
		})
	}
}

func TestImageModelsEnableImageGenerationEndpoint(t *testing.T) {
	endpoints := GetEndpointTypesByChannelType(constant.ChannelTypeOpenAIVideo, "gr-image-2")
	if len(endpoints) == 0 || endpoints[0] != constant.EndpointTypeImageGeneration {
		t.Fatalf("OpenAI video image model endpoints = %#v, want image generation first", endpoints)
	}

	endpoints = GetEndpointTypesByChannelType(constant.ChannelTypeOpenAI, "nano-banana-pro")
	if len(endpoints) == 0 || endpoints[0] != constant.EndpointTypeImageGeneration {
		t.Fatalf("OpenAI image model endpoints = %#v, want image generation first", endpoints)
	}
}
