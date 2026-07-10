package operation_setting

import "testing"

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
			if price != test.price || key != test.key {
				t.Fatalf("got (%v, %q), want (%v, %q)", price, key, test.price, test.key)
			}
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
	if price != 0.36 || key != VideoResolution1080p {
		t.Fatalf("got (%v, %q), want (0.36, %q)", price, key, VideoResolution1080p)
	}

	price, key = GetVideoPerSecondPrice("video-test", "720p")
	if price != 0.15 || key != VideoResolutionDefault {
		t.Fatalf("got (%v, %q), want (0.15, %q)", price, key, VideoResolutionDefault)
	}

	if seconds := ResolveVideoDurationSeconds("", 0, "video-test"); seconds != 8 {
		t.Fatalf("got %d default seconds, want 8", seconds)
	}
}
