package operation_setting

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateToolPricesJSON(t *testing.T) {
	valid := []string{
		`{}`,
		`{"web_search":0,"web_search:gpt-4.1-mini*":25}`,
		`{"tool.name:model/provider+v1:beta*":1.5}`,
	}
	for _, value := range valid {
		require.NoError(t, ValidateToolPricesJSON(value), value)
	}

	invalid := []string{
		`[]`, `null`, `{"":1}`, `{"bad tool":1}`, `{"bad:tool":1}`,
		`{"tool:":1}`, `{"tool:model":1}`, `{"tool:*":1}`,
		`{"tool:mo*del*":1}`, `{"tool:model *":1}`, `{"tool:model?*":1}`,
		`{"tool":-1}`, `{"tool":1e999}`, `{"tool":"1"}`, `{"tool":true}`,
	}
	for _, value := range invalid {
		assert.Error(t, ValidateToolPricesJSON(value), value)
	}
}

func TestToolPriceLookupAndTolerantLoading(t *testing.T) {
	original := toolPriceSetting.Prices
	t.Cleanup(func() {
		toolPriceSetting.Prices = original
		RebuildToolPriceIndex()
	})

	LoadToolPricesFromJSONString(`{"custom":0,"custom:model*":2,"custom:model-long*":3,"bad tool":9,"negative":-2}`)
	assert.Equal(t, float64(0), GetToolPrice("custom"), "explicit zero must override fallback")
	assert.Equal(t, float64(2), GetToolPriceForModel("custom", "model-v1"))
	assert.Equal(t, float64(3), GetToolPriceForModel("custom", "model-long-v1"))
	assert.Equal(t, float64(10), GetToolPrice("web_search"), "hardcoded fallback remains available")
	assert.Equal(t, float64(0), GetToolPrice("negative"))
}

func TestRebuildToolPriceIndexIgnoresInvalidValues(t *testing.T) {
	original := toolPriceSetting.Prices
	t.Cleanup(func() {
		toolPriceSetting.Prices = original
		RebuildToolPriceIndex()
	})

	toolPriceSetting.Prices = map[string]float64{
		"web_search":    math.NaN(),
		"file_search":   math.Inf(1),
		"google_search": -1,
		"valid":         0,
	}
	RebuildToolPriceIndex()
	assert.Equal(t, float64(10), GetToolPrice("web_search"))
	assert.Equal(t, float64(2.5), GetToolPrice("file_search"))
	assert.Equal(t, float64(14), GetToolPrice("google_search"))
	assert.Equal(t, float64(0), GetToolPrice("valid"))
}
