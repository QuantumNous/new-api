package service

import (
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestDrawingProResolution(t *testing.T) {
	for _, tc := range []struct{ model, ratio, size string }{
		{"gpt-image-2.5-2k", "1:1", "2048x2048"}, {"gpt-image-2.5-2k", "2:3", "1712x2560"},
		{"gpt-image-2.5-4k", "1:1", "2880x2880"}, {"gpt-image-2.5-4k", "16:9", "3840x2160"},
		{"gpt-image-2.5", "21:9", "1792x768"},
	} {
		size, err := DrawingSize(tc.model, tc.ratio)
		require.NoError(t, err)
		assert.Equal(t, tc.size, size)
	}
	_, err := DrawingSize("gpt-image-2.5-4k", "21:9")
	assert.Error(t, err)
}
func TestProAliasAPISizeAndLocalGPUBypass(t *testing.T) {
	for _, tc := range []struct{ model, size, want string }{
		{"gpt-image-2.5-2k", "", "2048x2048"}, {"gpt-image-2.5-4k", "auto", "2880x2880"},
		{"gpt-image-2.5-2k", "3840x2160", "2048x1152"}, {"gpt-image-2.5-4k", "1536x864", "3840x2160"},
		{"gpt-image-2.5-4k", "1712x2560", "2560x3840"}, {"gpt-image-2.5-2k", "1024x1365", "1536x2048"},
	} {
		size, err := ProImageRequestSize(tc.model, tc.size)
		require.NoError(t, err)
		assert.Equal(t, tc.want, size)
	}
	for _, size := range []string{"1792x768", "0x1024", "-1x1024", "999999999999999999x1", "4K"} {
		_, err := ProImageRequestSize("gpt-image-2.5-4k", size)
		assert.Error(t, err)
	}
	assert.Equal(t, 0, LocalImageUpscaleTarget("gpt-image-2.5-4k", "image2.5-pro"))
	assert.Equal(t, 4096, LocalImageUpscaleTarget("gpt-image-2.5-4k", "gpt-image-2.5"))
}
