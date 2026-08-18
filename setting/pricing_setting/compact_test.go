package pricing_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/autopricing"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/require"
)

func replaceManualModelPrices(t *testing.T, prices string) {
	t.Helper()
	saved, err := common.Marshal(ratio_setting.GetModelPriceCopy())
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(saved)))
	})
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(prices))
}

func TestResolveModelCompactWildcardPrecedesNormalizedBaseWildcard(t *testing.T) {
	replaceManualModelPrices(t, `{
		"gpt-4-gizmo-*": 0.2,
		"*-openai-compact": 0.1
	}`)

	pricingModel, source := ResolveModel("gpt-4-gizmo-customer-openai-compact")
	require.Equal(t, ratio_setting.CompactWildcardModelKey, pricingModel)
	require.Equal(t, "compact_wildcard_manual", source)
}

func TestResolveModelUsesNormalizedExactCompactPrice(t *testing.T) {
	replaceManualModelPrices(t, `{
		"gpt-4-gizmo-*-openai-compact": 0.3,
		"*-openai-compact": 0.1
	}`)

	modelName := "gpt-4-gizmo-customer-openai-compact"
	pricingModel, source := ResolveModel(modelName)
	require.Equal(t, "gpt-4-gizmo-*-openai-compact", pricingModel)
	require.Equal(t, "compact_exact_manual", source)
}

func TestResolveModelUsesNormalizedExactCompactTieredPrice(t *testing.T) {
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() { require.NoError(t, config.GlobalConfig.LoadFromDB(saved)) })

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"gpt-4-gizmo-*-openai-compact":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"gpt-4-gizmo-*-openai-compact":"p + c"}`,
	}))

	pricingModel, source := ResolveModel("gpt-4-gizmo-customer-openai-compact")
	require.Equal(t, "gpt-4-gizmo-*-openai-compact", pricingModel)
	require.Equal(t, "compact_exact_manual", source)
}

func TestResolveModelNonGPTCompactAlwaysUsesBasePricing(t *testing.T) {
	replaceManualModelPrices(t, `{
		"ordinary-model": 0.2,
		"ordinary-model-openai-compact": 0.3,
		"*-openai-compact": 0.1
	}`)

	pricingModel, source := ResolveModel("ordinary-model-openai-compact")
	require.Equal(t, "ordinary-model", pricingModel)
	require.Equal(t, "compact_base_manual", source)
}

func TestResolveModelNonGPTCompactIgnoresCompactAutomaticEntry(t *testing.T) {
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
		"ordinary-auto": {
			"input_cost_per_token": 0.000004,
			"output_cost_per_token": 0.00002
		},
		"ordinary-auto-openai-compact": {
			"input_cost_per_token": 0.000006,
			"output_cost_per_token": 0.00003
		}
	}`), "test")
	require.NoError(t, err)
	autopricing.SetCatalog(catalog)

	pricingModel, source := ResolveModel("ordinary-auto-openai-compact")
	require.Equal(t, "ordinary-auto", pricingModel)
	require.Equal(t, "compact_base_auto", source)
}

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
		"gpt-zz-auto-compact-base": {
			"input_cost_per_token": 0.000004,
			"output_cost_per_token": 0.00002
		}
	}`), "test")
	require.NoError(t, err)
	autopricing.SetCatalog(catalog)

	pricingModel, source := ResolveModel("gpt-zz-auto-compact-base-openai-compact")
	require.Equal(t, "gpt-zz-auto-compact-base", pricingModel)
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
		"gpt-zz-auto-exact-openai-compact": {
			"input_cost_per_token": 0.000006,
			"output_cost_per_token": 0.00003
		},
		"gpt-zz-auto-exact": {
			"input_cost_per_token": 0.000004,
			"output_cost_per_token": 0.00002
		}
	}`), "test")
	require.NoError(t, err)
	autopricing.SetCatalog(catalog)

	pricingModel, source := ResolveModel("gpt-zz-auto-exact-openai-compact")
	require.Equal(t, "gpt-zz-auto-exact-openai-compact", pricingModel)
	require.Equal(t, "compact_exact_auto", source)
}
