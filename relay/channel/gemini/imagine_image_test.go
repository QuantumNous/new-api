package gemini

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestBuildGeminiImagineRequestFromImage(t *testing.T) {
	req := buildGeminiImagineRequestFromImage(dto.ImageRequest{
		Prompt:  "a yellow banana",
		Size:    "9:16",
		Quality: "hd",
	})
	require.Len(t, req.Contents, 1)
	require.Equal(t, "user", req.Contents[0].Role)
	require.Equal(t, "a yellow banana", req.Contents[0].Parts[0].Text)
	require.Equal(t, []string{"TEXT", "IMAGE"}, req.GenerationConfig.ResponseModalities)

	var cfg map[string]string
	require.NoError(t, json.Unmarshal(req.GenerationConfig.ImageConfig, &cfg))
	require.Equal(t, "9:16", cfg["aspectRatio"])
	require.Equal(t, "2K", cfg["imageSize"])
}

func TestBuildGeminiImagineRequestSizeMapping(t *testing.T) {
	req := buildGeminiImagineRequestFromImage(dto.ImageRequest{
		Prompt: "x",
		Size:   "1792x1024",
	})
	var cfg map[string]string
	require.NoError(t, json.Unmarshal(req.GenerationConfig.ImageConfig, &cfg))
	require.Equal(t, "16:9", cfg["aspectRatio"])
	_, hasSize := cfg["imageSize"]
	require.False(t, hasSize)
}
