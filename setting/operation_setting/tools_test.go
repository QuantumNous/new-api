package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetToolPriceForModelSupportsConfiguredToolNames(t *testing.T) {
	originalPrices := toolPriceSetting.Prices
	t.Cleanup(func() {
		toolPriceSetting.Prices = originalPrices
		RebuildToolPriceIndex()
	})

	toolPriceSetting.Prices = map[string]float64{
		"toutiao":                       4,
		"toutiao:deepseek-v4-flash*":    2,
		"web_search:deepseek-v4-flash*": 8,
	}
	RebuildToolPriceIndex()

	require.Equal(t, 2.0, GetToolPriceForModel("toutiao", "deepseek-v4-flash"))
	require.Equal(t, 4.0, GetToolPriceForModel("toutiao", "other-model"))
	require.Equal(t, 8.0, GetToolPriceForModel("web_search", "deepseek-v4-flash"))
}
