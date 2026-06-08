package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestImageRequestPreservesImageUrlsOnMarshal(t *testing.T) {
	raw := []byte(`{
		"model": "gpt-image-2",
		"prompt": "edit the sky",
		"image_urls": ["https://example.com/a.png", "https://example.com/b.png"],
		"size": "1024x1024",
		"n": 1
	}`)

	var req ImageRequest
	require.NoError(t, common.Unmarshal(raw, &req))
	require.Equal(t, []string{"https://example.com/a.png", "https://example.com/b.png"}, req.ImageUrls)
	_, ok := req.Extra["image_urls"]
	require.False(t, ok, "image_urls should be a known field, not in Extra")

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	urls := gjson.GetBytes(encoded, "image_urls").Array()
	require.Len(t, urls, 2)
	require.Equal(t, "https://example.com/a.png", urls[0].String())
	require.Equal(t, "https://example.com/b.png", urls[1].String())
	require.Equal(t, "gpt-image-2", gjson.GetBytes(encoded, "model").String())
	require.Equal(t, "edit the sky", gjson.GetBytes(encoded, "prompt").String())
}

func TestImageRequestOmitsImageUrlsWhenAbsent(t *testing.T) {
	raw := []byte(`{
		"model": "dall-e-3",
		"prompt": "a red balloon",
		"size": "1024x1024"
	}`)

	var req ImageRequest
	require.NoError(t, common.Unmarshal(raw, &req))
	require.Nil(t, req.ImageUrls)

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	require.False(t, gjson.GetBytes(encoded, "image_urls").Exists())
	require.Equal(t, "dall-e-3", gjson.GetBytes(encoded, "model").String())
	require.Equal(t, "a red balloon", gjson.GetBytes(encoded, "prompt").String())
}
