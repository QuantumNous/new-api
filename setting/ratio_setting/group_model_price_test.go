package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetGroupModelPrice(t *testing.T) {
	original := GroupModelPrice2JSONString()
	defer func() {
		_ = UpdateGroupModelPriceByJSONString(original)
	}()

	require.NoError(t, UpdateGroupModelPriceByJSONString(`{
		"vip": {
			"grok-imagine-1.0-edit": 0.02
		}
	}`))

	price, ok := GetGroupModelPrice("vip", "grok-imagine-1.0-edit")
	require.True(t, ok)
	require.Equal(t, 0.02, price)

	_, ok = GetGroupModelPrice("default", "grok-imagine-1.0-edit")
	require.False(t, ok)
}

func TestGetGroupModelPriceBySeconds(t *testing.T) {
	original := GroupModelPriceBySeconds2JSONString()
	defer func() {
		_ = UpdateGroupModelPriceBySecondsByJSONString(original)
	}()

	require.NoError(t, UpdateGroupModelPriceBySecondsByJSONString(`{
		"vip": {
			"grok-imagine-1.0-video": {
				"6": 0.05,
				"8": 0.07
			}
		}
	}`))

	price, ok := GetGroupModelPriceBySeconds("vip", "grok-imagine-1.0-video", 8)
	require.True(t, ok)
	require.Equal(t, 0.07, price)

	_, ok = GetGroupModelPriceBySeconds("default", "grok-imagine-1.0-video", 8)
	require.False(t, ok)
}

func TestGetGroupModelPriceByResolution(t *testing.T) {
	original := GroupModelPriceByResolution2JSONString()
	defer func() {
		_ = UpdateGroupModelPriceByResolutionByJSONString(original)
	}()

	require.NoError(t, UpdateGroupModelPriceByResolutionByJSONString(`{
		"vip": {
			"nano-banana-pro": {
				"1K": 0.07,
				"2K": 0.12
			}
		}
	}`))

	price, ok := GetGroupModelPriceByResolution("vip", "nano-banana-pro", "2k")
	require.True(t, ok)
	require.Equal(t, 0.12, price)

	_, ok = GetGroupModelPriceByResolution("vip", "nano-banana-pro", "4K")
	require.False(t, ok)
}
