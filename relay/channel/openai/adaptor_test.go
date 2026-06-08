package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/samber/lo"
	"github.com/stretchr/testify/require"
)

func TestConvertGrokImageRequestMapsOpenAICompatibleParams(t *testing.T) {
	got := convertGrokImageRequest(dto.ImageRequest{
		Model:          "grok-imagine-image-lite",
		Prompt:         "a small dog",
		N:              lo.ToPtr(uint(3)),
		Size:           "1792x1024",
		Quality:        "high",
		ResponseFormat: "url",
	})

	require.Equal(t, "grok-imagine-image-lite", got.Model)
	require.Equal(t, "a small dog", got.Prompt)
	require.Equal(t, 3, got.N)
	require.Equal(t, "url", got.ResponseFormat)
	require.Equal(t, "16:9", got.AspectRatio)
	require.Empty(t, got.Resolution)
}

func TestConvertGrokImageRequestMapsResolution(t *testing.T) {
	got := convertGrokImageRequest(dto.ImageRequest{
		Model: "grok-imagine-image-quality",
		Size:  "1k",
	})

	require.Equal(t, 1, got.N)
	require.Empty(t, got.AspectRatio)
	require.Equal(t, "1k", got.Resolution)
}
