package pricing_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/pkg/autopricing"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/require"
)

func TestResolveModelFallsBackToBaseAutomaticPricing(t *testing.T) {
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
		autopricing.SetCatalog(nil)
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"auto_pricing.enabled":             "true",
		"auto_pricing.fuzzy_match_enabled": "true",
	}))
	catalog, err := autopricing.BuildCatalog([]byte(`{
		"zz-auto-compact-base": {
			"input_cost_per_token": 0.000004,
			"output_cost_per_token": 0.00002
		}
	}`), "test")
	require.NoError(t, err)
	autopricing.SetCatalog(catalog)

	pricingModel, source := ResolveModel("zz-auto-compact-base-openai-compact")
	require.Equal(t, "zz-auto-compact-base", pricingModel)
	require.Equal(t, "compact_base_auto", source)
}

func TestResolveModelUsesExactCompactAutomaticPricingBeforeBase(t *testing.T) {
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
		autopricing.SetCatalog(nil)
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"auto_pricing.enabled":             "true",
		"auto_pricing.fuzzy_match_enabled": "true",
	}))
	catalog, err := autopricing.BuildCatalog([]byte(`{
		"zz-auto-exact-openai-compact": {
			"input_cost_per_token": 0.000006,
			"output_cost_per_token": 0.00003
		},
		"zz-auto-exact": {
			"input_cost_per_token": 0.000004,
			"output_cost_per_token": 0.00002
		}
	}`), "test")
	require.NoError(t, err)
	autopricing.SetCatalog(catalog)

	pricingModel, source := ResolveModel("zz-auto-exact-openai-compact")
	require.Equal(t, "zz-auto-exact-openai-compact", pricingModel)
	require.Equal(t, "compact_exact_auto", source)
}
