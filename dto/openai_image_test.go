package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestImageRequestPreserveExplicitZeroSeed(t *testing.T) {
	raw := []byte(`{
		"model":"nano-banana",
		"prompt":"poster",
		"seed":0
	}`)

	var req ImageRequest
	err := common.Unmarshal(raw, &req)
	require.NoError(t, err)

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	require.True(t, gjson.GetBytes(encoded, "seed").Exists())
}

func TestImageRequestPreservesImageUrls(t *testing.T) {
	raw := []byte(`{
		"model":"nano-banana-pro",
		"prompt":"poster",
		"image_urls":["https://example.com/1.png","https://example.com/2.png"]
	}`)

	var req ImageRequest
	err := common.Unmarshal(raw, &req)
	require.NoError(t, err)

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	require.Equal(t, "https://example.com/1.png", gjson.GetBytes(encoded, "image_urls.0").String())
	require.Equal(t, "https://example.com/2.png", gjson.GetBytes(encoded, "image_urls.1").String())
	require.NotContains(t, req.Extra, "image_urls")
}

func TestImageRequestBananaUsesNeutralImagePriceRatio(t *testing.T) {
	n := uint(3)
	req := ImageRequest{
		Model:            "nano-banana-pro",
		Prompt:           "poster",
		N:                &n,
		OutputResolution: "4K",
	}

	meta := req.GetTokenCountMeta()

	require.NotNil(t, meta)
	require.Equal(t, 1.0, meta.ImagePriceRatio)
}
