package xai

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/samber/lo"
	"github.com/stretchr/testify/require"
)

func TestConvertImageRequestMapsAspectRatio(t *testing.T) {
	got := ConvertImageRequest(dto.ImageRequest{
		Model:          "grok-imagine-image-lite",
		Prompt:         "a small dog",
		N:              lo.ToPtr(uint(2)),
		Size:           "16:9",
		Quality:        "high",
		ResponseFormat: "url",
	})

	require.Equal(t, "grok-imagine-image-lite", got.Model)
	require.Equal(t, "a small dog", got.Prompt)
	require.Equal(t, 2, got.N)
	require.Equal(t, "url", got.ResponseFormat)
	require.Equal(t, "16:9", got.AspectRatio)
	require.Empty(t, got.Resolution)
}

func TestConvertImageRequestMapsSizeToAspectRatio(t *testing.T) {
	got := ConvertImageRequest(dto.ImageRequest{
		Model: "grok-imagine-image-quality",
		Size:  "1024x1024",
	})

	require.Equal(t, 1, got.N)
	require.Equal(t, "1:1", got.AspectRatio)
	require.Empty(t, got.Resolution)
}

func TestConvertImageRequestKeepsAutoAspectRatio(t *testing.T) {
	got := ConvertImageRequest(dto.ImageRequest{
		Model: "grok-imagine-image",
		Size:  "auto",
	})

	require.Equal(t, 1, got.N)
	require.Equal(t, "auto", got.AspectRatio)
	require.Empty(t, got.Resolution)
}

func TestConvertImageRequestMapsResolution(t *testing.T) {
	got := ConvertImageRequest(dto.ImageRequest{
		Model: "grok-imagine-image",
		Size:  "2k",
	})

	require.Empty(t, got.AspectRatio)
	require.Equal(t, "2k", got.Resolution)
}
