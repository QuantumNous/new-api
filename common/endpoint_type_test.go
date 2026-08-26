package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
)

func TestOpenAIChannelCLIProxyCodexModelsSupportChatAndResponses(t *testing.T) {
	want := []constant.EndpointType{
		constant.EndpointTypeOpenAI,
		constant.EndpointTypeOpenAIResponse,
		constant.EndpointTypeOpenAIResponseCompact,
		constant.EndpointTypeOpenAIAlphaSearch,
	}

	for _, model := range []string{
		"gpt-5.6-sol",
		"gpt-5.4",
		"gpt-5.3-codex-spark",
		"codex-auto-review",
		"codex/gpt-5.6-sol",
	} {
		t.Run(model, func(t *testing.T) {
			assert.Equal(t, want, GetEndpointTypesByChannelType(constant.ChannelTypeOpenAI, model))
		})
	}
}

func TestOpenAIChannelCLIProxyStandaloneImageModelsUseImagesAPI(t *testing.T) {
	want := []constant.EndpointType{constant.EndpointTypeImageGeneration}
	for _, model := range []string{
		"gpt-image-1.5",
		"gpt-image-2",
		"codex/gpt-image-2",
	} {
		t.Run(model, func(t *testing.T) {
			assert.Equal(t, want, GetEndpointTypesByChannelType(constant.ChannelTypeOpenAI, model))
		})
	}
}

func TestOpenAIChannelGPTModelsExposeChatAndResponses(t *testing.T) {
	want := []constant.EndpointType{
		constant.EndpointTypeOpenAI,
		constant.EndpointTypeOpenAIResponse,
	}
	for _, model := range []string{"gpt-4o", "openai/GPT-4.1"} {
		t.Run(model, func(t *testing.T) {
			assert.Equal(t, want, GetEndpointTypesByChannelType(constant.ChannelTypeOpenAI, model))
		})
	}
}

func TestGeminiNativeImageModelsExposeImageGenerationEndpoint(t *testing.T) {
	for _, model := range []string{
		"nano-banana-2",
		"gemini-2.5-flash-image",
		"gemini-3-pro-image",
		"gemini-2.0-flash-exp-image-generation",
	} {
		t.Run(model, func(t *testing.T) {
			got := GetEndpointTypesByChannelType(constant.ChannelTypeGemini, model)
			assert.Contains(t, got, constant.EndpointTypeImageGeneration)
			assert.Contains(t, got, constant.EndpointTypeGemini)
			assert.Contains(t, got, constant.EndpointTypeOpenAI)
			assert.Contains(t, got, constant.EndpointTypeAnthropic)
		})
	}
}

func TestGeminiAndVertexChannelsAcceptAnthropicMessages(t *testing.T) {
	want := []constant.EndpointType{
		constant.EndpointTypeGemini,
		constant.EndpointTypeOpenAI,
		constant.EndpointTypeAnthropic,
	}
	assert.Equal(t, want, GetEndpointTypesByChannelType(constant.ChannelTypeGemini, "gemini-3.7-flash"))
	assert.Equal(t, want, GetEndpointTypesByChannelType(constant.ChannelTypeVertexAi, "gemini-3.7-flash"))
}

func TestGenericImageSubstringDoesNotForceImageEndpoint(t *testing.T) {
	got := GetEndpointTypesByChannelType(constant.ChannelTypeOpenAI, "stable-image-v1")
	assert.NotContains(t, got, constant.EndpointTypeImageGeneration)
}

func TestXAIVideoModelsExposeVideoEndpoint(t *testing.T) {
	for _, model := range []string{
		"grok-imagine-video",
		"grok-imagine-video-1.5",
		"grok-imagine-video-1.5-preview",
	} {
		t.Run(model, func(t *testing.T) {
			assert.Equal(t,
				[]constant.EndpointType{constant.EndpointTypeOpenAIVideo},
				GetEndpointTypesByChannelType(constant.ChannelTypeXai, model),
			)
		})
	}
}
