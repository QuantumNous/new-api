package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetModelPriceByResolution(t *testing.T) {
	original := ModelPriceByResolution2JSONString()
	defer func() {
		_ = UpdateModelPriceByResolutionByJSONString(original)
	}()

	require.NoError(t, UpdateModelPriceByResolutionByJSONString(`{
		"nano-banana": {
			"1K": 0.02,
			"2k": 0.05,
			"4K": 0.1
		}
	}`))

	price, ok := GetModelPriceByResolution("nano-banana", "1k")
	require.True(t, ok)
	require.Equal(t, 0.02, price)

	price, ok = GetModelPriceByResolution("nano-banana", "2K")
	require.True(t, ok)
	require.Equal(t, 0.05, price)

	price, ok = GetModelPriceByResolution("nano-banana", "4k")
	require.True(t, ok)
	require.Equal(t, 0.1, price)
}
