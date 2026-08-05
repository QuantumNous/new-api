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

func TestOpenAIChannelLegacyModelEndpointTypeIsUnchanged(t *testing.T) {
	assert.Equal(t,
		[]constant.EndpointType{constant.EndpointTypeOpenAI},
		GetEndpointTypesByChannelType(constant.ChannelTypeOpenAI, "gpt-4o"),
	)
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
