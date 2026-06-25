package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestImageRequestInputImageSources(t *testing.T) {
	raw := []byte(`{
		"model":"gemini-2.5-flash-image",
		"prompt":"edit",
		"image":"https://example.com/input.png",
		"images":[
			"data:image/png;base64,aW1hZ2U=",
			{"url":"https://example.com/second.webp"},
			{"image_url":{"url":"https://example.com/openai-style.jpg"}},
			{"b64_json":"aW1hZ2Uy"}
		]
	}`)

	var req ImageRequest
	require.NoError(t, common.Unmarshal(raw, &req))

	sources, err := req.InputImageSources()
	require.NoError(t, err)
	require.Len(t, sources, 5)

	_, ok := sources[0].(*types.URLSource)
	require.True(t, ok)
	require.Equal(t, "https://example.com/input.png", sources[0].GetRawData())

	_, ok = sources[1].(*types.Base64Source)
	require.True(t, ok)
	require.Equal(t, "data:image/png;base64,aW1hZ2U=", sources[1].GetRawData())

	require.Equal(t, "https://example.com/second.webp", sources[2].GetRawData())
	require.Equal(t, "https://example.com/openai-style.jpg", sources[3].GetRawData())
	require.Equal(t, "aW1hZ2Uy", sources[4].GetRawData())
}

func TestImageRequestInputImageSourcesRejectsScalarJSON(t *testing.T) {
	var req ImageRequest
	require.NoError(t, common.Unmarshal([]byte(`{"model":"m","prompt":"p","image":123}`), &req))

	_, err := req.InputImageSources()
	require.Error(t, err)
	require.Contains(t, err.Error(), "image input must be")
}
