package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func float64Pointer(value float64) *float64 {
	return &value
}

func TestImageTierPriceFallbacks(t *testing.T) {
	original := imageModelSetting
	defer func() {
		imageModelSetting = original
		rebuildImageModelIndex()
	}()

	imageModelSetting = ImageModelSetting{Models: map[string]ImageModelConfig{
		"image-test": {
			BillingMode: ImageBillingModePerSize,
			Price1K:     float64Pointer(0.04),
			Price4K:     float64Pointer(0.10),
			PriceMatrix: map[string]float64{
				"1K_MEDIUM": 0.05,
				"2k_high":   0.12,
				"default":   0.06,
			},
		},
	}}
	rebuildImageModelIndex()

	tests := []struct {
		name    string
		size    string
		quality string
		price   float64
		key     string
	}{
		{name: "default quality prefers medium matrix", size: "1024x1024", price: 0.05, key: "1k_medium"},
		{name: "exact quality tier", size: "2048x2048", quality: "high", price: 0.12, key: "2k_high"},
		{name: "quality falls back to matrix default", size: "2048x2048", quality: "low", price: 0.06, key: "default"},
		{name: "default quality prefers legacy size", size: "4096x4096", price: 0.10, key: "4k"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			price, key := GetImageTierPrice("image-test", test.size, test.quality)
			assert.Equal(t, test.price, price)
			assert.Equal(t, test.key, key)
		})
	}
}

func TestVideoPerSecondPriceFallbacks(t *testing.T) {
	original := videoModelSetting
	defer func() {
		videoModelSetting = original
		rebuildVideoModelIndex()
	}()

	videoModelSetting = VideoModelSetting{Models: map[string]VideoModelConfig{
		"video-test": {
			BillingMode:    VideoBillingModePerSecond,
			DefaultSeconds: 8,
			PriceMatrix: map[string]float64{
				"1080P":   0.36,
				"default": 0.15,
			},
		},
	}}
	rebuildVideoModelIndex()

	price, key := GetVideoPerSecondPrice("video-test", "1920x1080")
	assert.Equal(t, 0.36, price)
	assert.Equal(t, VideoResolution1080p, key)

	price, key = GetVideoPerSecondPrice("video-test", "720p")
	assert.Equal(t, 0.15, price)
	assert.Equal(t, VideoResolutionDefault, key)

	assert.Equal(t, 8, ResolveVideoDurationSeconds("", 0, "video-test"))
}
