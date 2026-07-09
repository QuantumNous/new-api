package dto

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestImageRequestBuiltInUnitPrice(t *testing.T) {
	tests := []struct {
		name    string
		request ImageRequest
		want    float64
	}{
		{
			name: "gpt-image-2 medium 2k square",
			request: ImageRequest{
				Model:   "gpt-image-2",
				Size:    "2048x2048",
				Quality: "medium",
			},
			want: 0.10704,
		},
		{
			name: "gpt-image-2 high 4k landscape",
			request: ImageRequest{
				Model:   "gpt-image-2",
				Size:    "3840x2160",
				Quality: "high",
			},
			want: 0.40026,
		},
		{
			name: "banana 2 4k",
			request: ImageRequest{
				Model: "gemini-3.1-flash-image",
				Size:  "4096x4096",
			},
			want: 0.151,
		},
		{
			name: "banana pro 2k",
			request: ImageRequest{
				Model: "gemini-3-pro-image",
				Size:  "2048x2048",
			},
			want: 0.134,
		},
		{
			name: "empty size defaults to 1k",
			request: ImageRequest{
				Model: "gemini-3.1-flash-image",
			},
			want: 0.067,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			meta := test.request.GetTokenCountMeta()
			require.InDelta(t, test.want, meta.ImageUnitPrice, 0.000001)
		})
	}
}

func TestImageRequestUnknownBuiltInPriceKeepsLegacyImageRatio(t *testing.T) {
	req := ImageRequest{
		Model:   "dall-e-3",
		Size:    "1024x1792",
		Quality: "hd",
	}

	meta := req.GetTokenCountMeta()

	require.Zero(t, meta.ImageUnitPrice)
	require.Equal(t, 3.0, meta.ImagePriceRatio)
}
