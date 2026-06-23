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
		Model:      "gpt-image-2",
		Prompt:     "太阳在西边",
		N:          &n,
		Size:       "1:1",
		Resolution: "1k",
	}
	data := BuildImageRequestDataForLog(req)
	require.Equal(t, "gpt-image-2", data["model"])
	require.Equal(t, "太阳在西边", data["prompt"])
	require.Equal(t, uint(1), data["n"])
	require.Equal(t, "1:1", data["size"])
	require.Equal(t, "1k", data["resolution"])
	require.Equal(t, "1K", data["effective_resolution"])
	require.Equal(t, uint(1), data["actual_image_count"])
}
