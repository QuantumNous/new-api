package model

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/require"
)

func TestApplyConfiguredPricingAddsVideoSecondsPrice(t *testing.T) {
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateVideoSecondsPriceByJSONString(`{}`))
	})

	require.NoError(t, ratio_setting.UpdateVideoSecondsPriceByJSONString(`{
		"happyhorse-1.1-r2v": {
			"720p": {"default": 0.9}
		}
	}`))

	pricing := Pricing{ModelName: "happyhorse-1.1-r2v"}
	applyConfiguredPricing("happyhorse-1.1-r2v", &pricing)

	require.Equal(t, 0.9, pricing.VideoSecondsPrice["720p"]["default"])
}

func TestApplyConfiguredPricingIncludesVideoSecondsBillingMode(t *testing.T) {
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"happyhorse-1.1-r2v":"video_seconds"}`,
	}))

	pricing := Pricing{ModelName: "happyhorse-1.1-r2v"}
	applyConfiguredPricing("happyhorse-1.1-r2v", &pricing)

	require.Equal(t, "video_seconds", pricing.BillingMode)
}
