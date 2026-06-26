package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// snapshotGPTImage1Prices returns a deep copy of the current price grid so
// tests can mutate the package-level setting and restore it via t.Cleanup.
func snapshotGPTImage1Prices() map[string]map[string]float64 {
	out := make(map[string]map[string]float64, len(gptImage1PriceSetting.Prices))
	for quality, sizes := range gptImage1PriceSetting.Prices {
		inner := make(map[string]float64, len(sizes))
		for size, price := range sizes {
			inner[size] = price
		}
		out[quality] = inner
	}
	return out
}

// withGPTImage1PriceSetting snapshots the whole setting and restores it on
// cleanup, isolating each test that mutates the package-level config.
func withGPTImage1PriceSetting(t *testing.T) {
	t.Helper()
	snapPrices := snapshotGPTImage1Prices()
	snapDefault := gptImage1PriceSetting.DefaultPrice
	snapUseGroupRatio := gptImage1PriceSetting.UseGroupRatio
	t.Cleanup(func() {
		gptImage1PriceSetting.Prices = snapPrices
		gptImage1PriceSetting.DefaultPrice = snapDefault
		gptImage1PriceSetting.UseGroupRatio = snapUseGroupRatio
	})
}

func TestGetGPTImage1PriceOnceCallDefaultGrid(t *testing.T) {
	withGPTImage1PriceSetting(t)

	cases := []struct {
		quality string
		size    string
		want    float64
	}{
		{"low", "1024x1024", 0.011},
		{"low", "1024x1536", 0.016},
		{"low", "1536x1024", 0.016},
		{"medium", "1024x1024", 0.042},
		{"medium", "1024x1536", 0.063},
		{"medium", "1536x1024", 0.063},
		{"high", "1024x1024", 0.167},
		{"high", "1024x1536", 0.25},
		{"high", "1536x1024", 0.25},
	}
	for _, c := range cases {
		assert.Equal(t, c.want, GetGPTImage1PriceOnceCall(c.quality, c.size),
			"quality=%s size=%s", c.quality, c.size)
	}
}

func TestGetGPTImage1PriceOnceCallConfigOverridesConst(t *testing.T) {
	withGPTImage1PriceSetting(t)

	gptImage1PriceSetting.Prices["low"]["1024x1024"] = 0.5
	assert.Equal(t, 0.5, GetGPTImage1PriceOnceCall("low", "1024x1024"))
}

func TestGetGPTImage1PriceOnceCallUnknownSizeFallsBackToDefaultNotHigh(t *testing.T) {
	withGPTImage1PriceSetting(t)

	// Sentinel default makes the fallback source unambiguous.
	gptImage1PriceSetting.DefaultPrice = 0.1234
	got := GetGPTImage1PriceOnceCall("medium", "9999x9999")
	assert.Equal(t, 0.1234, got)
	assert.NotEqual(t, GPTImage1High1024x1024, got) // regression: must not fall back to high 0.167
}

func TestGetGPTImage1PriceOnceCallUnknownQualityFallsBackToDefault(t *testing.T) {
	withGPTImage1PriceSetting(t)

	gptImage1PriceSetting.DefaultPrice = 0.1234
	assert.Equal(t, 0.1234, GetGPTImage1PriceOnceCall("ultra", "1024x1024"))
}

func TestGetGPTImage1PriceOnceCallEmptyQualitySizeFallsBackToDefault(t *testing.T) {
	withGPTImage1PriceSetting(t)

	gptImage1PriceSetting.DefaultPrice = 0.1234
	assert.Equal(t, 0.1234, GetGPTImage1PriceOnceCall("", ""))
}

func TestGetGPTImage1PriceOnceCallNonPositiveDefaultFallsBackToMedium(t *testing.T) {
	withGPTImage1PriceSetting(t)

	// A misconfigured (<=0) default must never yield a zero/negative price that
	// would let image generation bypass billing.
	gptImage1PriceSetting.DefaultPrice = -1
	got := GetGPTImage1PriceOnceCall("unknown-quality", "unknown-size")
	assert.Equal(t, GPTImage1Medium1024x1024, got)
	assert.Greater(t, got, 0.0)
}

func TestGetGPTImage1SurchargeUsesGroupRatioDefaultAndToggle(t *testing.T) {
	withGPTImage1PriceSetting(t)

	require.False(t, GetGPTImage1SurchargeUsesGroupRatio(), "default must decouple to stop low-group losses")

	gptImage1PriceSetting.UseGroupRatio = true
	assert.True(t, GetGPTImage1SurchargeUsesGroupRatio())

	gptImage1PriceSetting.UseGroupRatio = false
	assert.False(t, GetGPTImage1SurchargeUsesGroupRatio())
}
