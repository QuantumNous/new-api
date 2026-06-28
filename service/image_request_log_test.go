package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestBuildImageRequestDataForLog(t *testing.T) {
	t.Parallel()
	n := uint(1)
	req := &dto.ImageRequest{
		Model:      "gemini-3.1-flash-image-preview",
		Prompt:     "太阳在西边",
		N:          &n,
		Size:       "16:9",
		Resolution: "2k",
	}
	data := BuildImageRequestDataForLog(req)
	require.Equal(t, "gemini-3.1-flash-image-preview", data["model"])
	require.Equal(t, "16:9", data["size"])
	require.Equal(t, "2k", data["resolution"])
	require.Equal(t, "2K", data["effective_resolution"])
	require.InDelta(t, 4.0/3.0, data["resolution_price_ratio"].(float64), 0.001)
}
