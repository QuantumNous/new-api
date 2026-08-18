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

func TestResolveModelNonGPTIgnoresLegacyCompactWildcard(t *testing.T) {
	replaceManualModelPrices(t, `{
		"gemini-2.5-flash-thinking-*": 0.2,
		"*-openai-compact": 0.1
	}`)

	pricingModel, source := ResolveModel("gemini-2.5-flash-thinking-1024-openai-compact")
	require.Equal(t, "gemini-2.5-flash-thinking-*", pricingModel)
	require.Equal(t, "compact_base_manual", source)
}

func TestResolveModelNonGPTIgnoresExactCompactPrice(t *testing.T) {
	replaceManualModelPrices(t, `{
		"gemini-2.5-flash-thinking-*-openai-compact": 0.3,
		"gemini-2.5-flash-thinking-*": 0.4,
		"gpt-*-openai-compact": 0.1
	}`)

	modelName := "gemini-2.5-flash-thinking-1024-openai-compact"
	pricingModel, source := ResolveModel(modelName)
	require.Equal(t, "gemini-2.5-flash-thinking-*", pricingModel)
	require.Equal(t, "compact_base_manual", source)
}

func TestResolveModelNonGPTIgnoresExactCompactTieredPrice(t *testing.T) {
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() { require.NoError(t, config.GlobalConfig.LoadFromDB(saved)) })

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"gemini-2.5-flash-thinking-*-openai-compact":"tiered_expr","gemini-2.5-flash-thinking-*":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"gemini-2.5-flash-thinking-*-openai-compact":"p + c","gemini-2.5-flash-thinking-*":"p + c * 2"}`,
	}))

	pricingModel, source := ResolveModel("gemini-2.5-flash-thinking-1024-openai-compact")
	require.Equal(t, "gemini-2.5-flash-thinking-*", pricingModel)
	require.Equal(t, "compact_base_manual", source)
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

func TestResolveModelGPTManualPriority(t *testing.T) {
	replaceManualModelPrices(t, `{
		"gpt-exact-openai-compact": 0.4,
		"gpt-*-openai-compact": 0.3,
		"gpt-exact": 0.2,
		"*-openai-compact": 0.1
	}`)

	pricingModel, source := ResolveModel("gpt-exact-openai-compact")
	require.Equal(t, "gpt-exact-openai-compact", pricingModel)
	require.Equal(t, "compact_exact_manual", source)

	replaceManualModelPrices(t, `{
		"gpt-*-openai-compact": 0.3,
		"gpt-other": 0.2,
		"*-openai-compact": 0.1
	}`)
	pricingModel, source = ResolveModel("gpt-other-openai-compact")
	require.Equal(t, ratio_setting.CompactWildcardModelKey, pricingModel)
	require.Equal(t, "compact_wildcard_manual", source)
}
