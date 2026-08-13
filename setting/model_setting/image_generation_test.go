package model_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestImageGenerationCapabilitiesMatchConfiguredUpstreams(t *testing.T) {
	tests := []struct {
		model               string
		resolutionParameter string
		defaultResolution   string
		defaultSize         string
		sizeCount           int
	}{
		{model: "gemini-3.1-flash-image-preview", resolutionParameter: ImageResolutionParameterQuality, defaultResolution: "1K", defaultSize: "1:1", sizeCount: 10},
		{model: "gemini-3-pro-image-preview", resolutionParameter: ImageResolutionParameterQuality, defaultResolution: "1K", defaultSize: "1:1", sizeCount: 10},
		{model: "nano-banana-2", resolutionParameter: ImageResolutionParameterQuality, defaultResolution: "1K", defaultSize: "1:1", sizeCount: 5},
		{model: "nano-banana-pro", resolutionParameter: ImageResolutionParameterQuality, defaultResolution: "1K", defaultSize: "1:1", sizeCount: 5},
		{model: "gpt-image-2-vip", resolutionParameter: ImageResolutionParameterSize, defaultResolution: "2K", defaultSize: "2048x2048", sizeCount: 30},
	}

	for _, test := range tests {
		t.Run(test.model, func(t *testing.T) {
			capabilities := GetImageGenerationCapabilities(test.model)
			require.NotNil(t, capabilities)
			assert.Equal(t, []string{"1K", "2K", "4K"}, capabilities.Resolutions)
			assert.Equal(t, test.resolutionParameter, capabilities.ResolutionParameter)
			assert.Equal(t, test.defaultResolution, capabilities.DefaultResolution)
			assert.Equal(t, test.defaultSize, capabilities.DefaultSize)
			assert.Len(t, capabilities.Sizes, test.sizeCount)
		})
	}
}

func TestImageGenerationCapabilitiesReturnsIndependentSlices(t *testing.T) {
	first := GetImageGenerationCapabilities("nano-banana-2")
	require.NotNil(t, first)
	first.Resolutions[0] = "changed"
	first.Sizes[0] = "changed"
	first.ResolutionPriceMultiplier["4K"] = 99

	second := GetImageGenerationCapabilities("NANO-BANANA-2")
	require.NotNil(t, second)
	assert.Equal(t, "1K", second.Resolutions[0])
	assert.Equal(t, "1:1", second.Sizes[0])
	assert.Equal(t, float64(1), second.ResolutionPriceMultiplier["4K"])
	assert.Nil(t, GetImageGenerationCapabilities("chat-model"))
}

func TestImageGenerationPriceMultiplierMatchesConfiguredResolution(t *testing.T) {
	tests := []struct {
		name    string
		model   string
		quality string
		size    string
		want    float64
	}{
		{name: "flash 1K", model: "gemini-3.1-flash-image-preview", quality: "1K", want: 1},
		{name: "flash 4K", model: "gemini-3.1-flash-image-preview", quality: "4k", want: 2},
		{name: "pro 4K", model: "gemini-3-pro-image-preview", quality: "4K", want: 1},
		{name: "gpt 2K", model: "gpt-image-2-vip", size: "2048x2048", want: 1},
		{name: "gpt 4K", model: "gpt-image-2-vip", size: "3840x2160", want: 2},
		{name: "nano 4K", model: "nano-banana-pro", quality: "4K", want: 1},
		{name: "unknown model", model: "unknown", quality: "4K", want: 1},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.want, GetImageGenerationPriceMultiplier(test.model, test.quality, test.size))
		})
	}
}
