package autopricing

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseNewAPISourcePreservesTieredExpression(t *testing.T) {
	source, err := ParseNewAPISource([]byte(`{
		"success": true,
		"data": {
			"model_ratio": {"gpt-5.6-sol": 2.5},
			"completion_ratio": {"gpt-5.6-sol": 6},
			"cache_ratio": {"gpt-5.6-sol": 0.1},
			"billing_mode": {"gpt-5.6-sol": "tiered_expr"},
			"billing_expr": {
				"gpt-5.6-sol": "len <= 272000 ? tier(\"base\", p * 5 + c * 30) : tier(\"long\", p * 10 + c * 45)"
			}
		}
	}`), "newapi-v1")
	require.NoError(t, err)

	record, ok := source.Records["gpt-5.6-sol"]
	require.True(t, ok)
	require.NotNil(t, record.Standard.Input)
	require.NotNil(t, record.Standard.Output)
	assert.Equal(t, 5.0, *record.Standard.Input)
	assert.Equal(t, 30.0, *record.Standard.Output)
	assert.Equal(t, "tiered_expr", record.BillingMode)
	assert.Contains(t, record.BillingExpr, "len <= 272000")
	assert.Equal(t, SourceNewAPI, record.PrimarySource)
}

func TestParseModelsDevSourceUsesFirstPartyProviderNotCheapestAggregator(t *testing.T) {
	source, err := ParseModelsDevSource([]byte(`{
		"xpersona": {"models": {"gpt-5.6-sol": {"cost": {"input": 1.5, "output": 12}}}},
		"azure": {"models": {"gpt-5.6-sol": {"cost": {"input": 4, "output": 24}}}},
		"openai": {"models": {"gpt-5.6-sol": {"cost": {"input": 5, "output": 30, "cache_read": 0.5}}}}
	}`), "models-dev-v1")
	require.NoError(t, err)

	record, ok := source.Records["gpt-5.6-sol"]
	require.True(t, ok)
	assert.Equal(t, "openai", record.Provider)
	require.NotNil(t, record.Standard.Input)
	require.NotNil(t, record.Standard.Output)
	assert.Equal(t, 5.0, *record.Standard.Input)
	assert.Equal(t, 30.0, *record.Standard.Output)
}

func TestParseModelsDevSourcePrefersControlledCloudOverAggregator(t *testing.T) {
	source, err := ParseModelsDevSource([]byte(`{
		"openrouter": {"models": {"vendor-model": {"cost": {"input": 1, "output": 2}}}},
		"azure": {"models": {"vendor-model": {"cost": {"input": 3, "output": 6}}}}
	}`), "models-dev-v1")
	require.NoError(t, err)

	record, ok := source.Records["vendor-model"]
	require.True(t, ok)
	assert.Equal(t, "azure", record.Provider)
	require.NotNil(t, record.Standard.Input)
	assert.Equal(t, 3.0, *record.Standard.Input)
}

func TestMergeSourcesUsesFixedFieldPrecedenceAndLowerSourceFill(t *testing.T) {
	liteLLM, err := ParseLiteLLMSource([]byte(`{
		"gpt-5.6-sol": {
			"input_cost_per_token": 0.000005,
			"output_cost_per_token": 0.000030,
			"cache_read_input_token_cost": 0.0000005,
			"cache_creation_input_token_cost": 0.00000625
		}
	}`), "litellm-v1")
	require.NoError(t, err)

	newAPI, err := ParseNewAPISource([]byte(`{
		"success": true,
		"data": {
			"model_ratio": {"gpt-5.6-sol": 2.5},
			"completion_ratio": {"gpt-5.6-sol": 6},
			"billing_mode": {"gpt-5.6-sol": "tiered_expr"},
			"billing_expr": {"gpt-5.6-sol": "tier(\"official\", p * 5 + c * 30)"}
		}
	}`), "newapi-v1")
	require.NoError(t, err)

	modelsDev, err := ParseModelsDevSource([]byte(`{
		"openai": {"models": {"gpt-5.6-sol": {"cost": {"input": 4, "output": 24, "cache_read": 0.4}}}}
	}`), "models-dev-v1")
	require.NoError(t, err)

	catalog, err := MergeSources(modelsDev, liteLLM, newAPI)
	require.NoError(t, err)

	entry, ok := catalog.Lookup("gpt-5.6-sol")
	require.True(t, ok)
	assert.Equal(t, SourceModelsDev, entry.Source)
	assert.Equal(t, 2.0, entry.ModelRatio)
	assert.Equal(t, 6.0, entry.CompletionRatio)
	assert.True(t, entry.HasCreateCacheRatio)
	assert.Equal(t, 1.5625, entry.CreateCacheRatio)
	assert.Equal(t, SourceLiteLLM, entry.FieldSources[FieldCacheWrite5m])
	assert.False(t, entry.HasBillingExpr)
	_, hasExpressionSource := entry.FieldSources[FieldBillingExpr]
	assert.False(t, hasExpressionSource)
}

func TestParseModelsDevSourceSkipsInvalidHigherPriorityProvider(t *testing.T) {
	source, err := ParseModelsDevSource([]byte(`{
		"openai": {"models": {"gpt-5.6-sol": {"cost": {"input": -1, "output": 30}}}},
		"azure": {"models": {"gpt-5.6-sol": {"cost": {"input": 4, "output": 24}}}}
	}`), "models-dev-v1")
	require.NoError(t, err)

	record := source.Records["gpt-5.6-sol"]
	assert.Equal(t, "azure", record.Provider)
	require.NotNil(t, record.Standard.Input)
	assert.Equal(t, 4.0, *record.Standard.Input)
}

func TestBillingExprServiceTierInheritsMissingStandardCosts(t *testing.T) {
	source := newSourceCatalog(SourceOverride, "service-tier-v1")
	source.Records["partial-priority"] = PriceRecord{
		Model: "partial-priority", PrimarySource: SourceOverride,
		Standard: CostSet{
			Input: pricePtr(2), Output: pricePtr(8), CacheRead: pricePtr(.2),
			ImageInput: pricePtr(3), AudioInput: pricePtr(4),
		},
		Priority: CostSet{Input: pricePtr(5)},
	}

	catalog, err := MergeSources(source)
	require.NoError(t, err)
	entry, ok := catalog.Lookup("partial-priority")
	require.True(t, ok)
	require.True(t, entry.HasBillingExpr)

	value, _, err := billingexpr.RunExprWithRequest(entry.BillingExpr, billingexpr.TokenParams{
		P: 10, C: 10, CR: 10, Img: 10, AI: 10,
	}, billingexpr.RequestInput{Body: []byte(`{"service_tier":"priority"}`)})
	require.NoError(t, err)
	assert.Equal(t, 202.0, value)
}

func TestMergeSourcesFillsOnlyMatchingTierStructures(t *testing.T) {
	high := newSourceCatalog(SourceModelsDev, "models-v1")
	high.Records["tiered"] = PriceRecord{
		Model: "tiered", PrimarySource: SourceModelsDev,
		Standard: CostSet{Input: pricePtr(2), Output: pricePtr(8)},
		Tiers: []PriceTier{
			{Name: "base", MaxInputTokens: 200000, Costs: CostSet{Input: pricePtr(2)}},
			{Name: "long", Costs: CostSet{Input: pricePtr(4)}},
		},
	}
	low := newSourceCatalog(SourceLiteLLM, "litellm-v1")
	low.Records["tiered"] = PriceRecord{
		Model: "tiered", PrimarySource: SourceLiteLLM,
		Standard: CostSet{Input: pricePtr(1), Output: pricePtr(4)},
		Tiers: []PriceTier{
			{Name: "base", MaxInputTokens: 200000, Costs: CostSet{Output: pricePtr(8)}},
			{Name: "long", Costs: CostSet{Output: pricePtr(12)}},
		},
	}

	catalog, err := MergeSources(high, low)
	require.NoError(t, err)
	record := catalog.records["tiered"]
	require.NotNil(t, record.Tiers[0].Costs.Output)
	require.NotNil(t, record.Tiers[1].Costs.Output)
	assert.Equal(t, 8.0, *record.Tiers[0].Costs.Output)
	assert.Equal(t, 12.0, *record.Tiers[1].Costs.Output)
	assert.Equal(t, SourceLiteLLM, record.FieldSources[FieldID("tier.0.output")])

	conflict := newSourceCatalog(SourceLiteLLM, "litellm-conflict")
	conflict.Records["tiered"] = PriceRecord{
		Model: "tiered", PrimarySource: SourceLiteLLM,
		Standard: CostSet{Input: pricePtr(1), Output: pricePtr(4)},
		Tiers:    []PriceTier{{Name: "different", MaxInputTokens: 100000, Costs: CostSet{Output: pricePtr(99)}}},
	}
	catalog, err = MergeSources(high, conflict)
	require.NoError(t, err)
	assert.Nil(t, catalog.records["tiered"].Tiers[0].Costs.Output)
}

func TestMergeSourcesTracksPriorityAndFlexFieldSourcesSeparately(t *testing.T) {
	high := newSourceCatalog(SourceModelsDev, "models-v1")
	high.Records["model"] = PriceRecord{
		Model: "model", PrimarySource: SourceModelsDev,
		Standard: CostSet{Input: pricePtr(2), Output: pricePtr(8)},
		Priority: CostSet{Input: pricePtr(3)},
	}
	low := newSourceCatalog(SourceLiteLLM, "litellm-v1")
	low.Records["model"] = PriceRecord{
		Model: "model", PrimarySource: SourceLiteLLM,
		Standard: CostSet{Input: pricePtr(1), Output: pricePtr(4)},
		Priority: CostSet{Input: pricePtr(9), Output: pricePtr(18)},
		Flex:     CostSet{Input: pricePtr(1), Output: pricePtr(2)},
	}

	catalog, err := MergeSources(high, low)
	require.NoError(t, err)
	record := catalog.records["model"]
	assert.Equal(t, 3.0, *record.Priority.Input)
	assert.Equal(t, 18.0, *record.Priority.Output)
	assert.Equal(t, SourceModelsDev, record.FieldSources[FieldPriorityInput])
	assert.Equal(t, SourceLiteLLM, record.FieldSources[FieldPriorityOutput])
	assert.Equal(t, SourceLiteLLM, record.FieldSources[FieldFlexInput])
	assert.Equal(t, SourceLiteLLM, record.FieldSources[FieldFlexOutput])
}

func TestCatalogAliasesNeverOverrideCanonicalModels(t *testing.T) {
	source := newSourceCatalog(SourceOverride, "alias-v1")
	source.Records["alpha"] = PriceRecord{Model: "alpha", PrimarySource: SourceOverride, Standard: CostSet{Input: pricePtr(2), Output: pricePtr(4)}, Aliases: []string{"beta", "shared"}}
	source.Records["beta"] = PriceRecord{Model: "beta", PrimarySource: SourceOverride, Standard: CostSet{Input: pricePtr(8), Output: pricePtr(16)}, Aliases: []string{"shared"}}

	for range 20 {
		catalog, err := MergeSources(source)
		require.NoError(t, err)
		beta, ok := catalog.Lookup("beta")
		require.True(t, ok)
		assert.Equal(t, "beta", beta.CatalogKey)
		assert.Equal(t, 4.0, beta.ModelRatio)
		shared, ok := catalog.Lookup("shared")
		require.True(t, ok)
		assert.Equal(t, "alpha", shared.CatalogKey)
	}
}

func TestCatalogSkipsInvalidCostsAndExpressions(t *testing.T) {
	source := newSourceCatalog(SourceNewAPI, "invalid-v1")
	source.Records["valid"] = PriceRecord{Model: "valid", PrimarySource: SourceNewAPI, Standard: CostSet{Input: pricePtr(2), Output: pricePtr(8)}}
	source.Records["negative-output"] = PriceRecord{Model: "negative-output", PrimarySource: SourceNewAPI, Standard: CostSet{Input: pricePtr(2), Output: pricePtr(-8)}}
	source.Records["invalid-expression"] = PriceRecord{Model: "invalid-expression", PrimarySource: SourceNewAPI, Standard: CostSet{Input: pricePtr(2), Output: pricePtr(8)}, BillingMode: "tiered_expr", BillingExpr: "p *"}
	source.Records["negative-audio-expression"] = PriceRecord{Model: "negative-audio-expression", PrimarySource: SourceNewAPI, Standard: CostSet{Input: pricePtr(2), Output: pricePtr(8)}, BillingMode: "tiered_expr", BillingExpr: "tier(\"audio\", ao * -1)"}

	catalog, err := MergeSources(source)
	require.NoError(t, err)
	assert.Equal(t, 1, catalog.ModelCount)
	assert.Equal(t, 3, catalog.SkippedCount)
	_, ok := catalog.Lookup("negative-output")
	assert.False(t, ok)
	_, ok = catalog.Lookup("invalid-expression")
	assert.False(t, ok)
	_, ok = catalog.Lookup("negative-audio-expression")
	assert.False(t, ok)
}

func TestParseLiteLLMSourceKeepsRichBillingFields(t *testing.T) {
	source, err := ParseLiteLLMSource([]byte(`{
		"rich-model": {
			"input_cost_per_token": 0.000002,
			"output_cost_per_token": 0.000008,
			"cache_read_input_token_cost": 0.0000002,
			"cache_creation_input_token_cost": 0.0000025,
			"cache_creation_input_token_cost_above_1hr": 0.000004,
			"input_cost_per_token_priority": 0.000004,
			"output_cost_per_token_priority": 0.000016,
			"cache_read_input_token_cost_priority": 0.0000004,
			"cache_creation_input_token_cost_priority": 0.000005,
			"input_cost_per_token_flex": 0.000001,
			"output_cost_per_token_flex": 0.000004,
			"input_cost_per_image_token": 0.000003,
			"output_cost_per_image_token": 0.000012,
			"input_cost_per_audio_token": 0.000006,
			"output_cost_per_audio_token": 0.000024,
			"output_cost_per_image": 0.04,
			"long_context_input_token_threshold": 272000,
			"input_cost_per_token_above_200k_tokens": 0.000004,
			"output_cost_per_token_above_200k_tokens": 0.000012,
			"cache_read_input_token_cost_above_200k_tokens": 0.0000004,
			"cache_creation_input_token_cost_above_200k_tokens": 0.000005
		}
	}`), "litellm-rich")
	require.NoError(t, err)

	record := source.Records["rich-model"]
	require.NotNil(t, record.Priority.Input)
	require.NotNil(t, record.Flex.Output)
	require.NotNil(t, record.Standard.CacheWrite1h)
	require.NotNil(t, record.Standard.ImageInput)
	require.NotNil(t, record.Standard.AudioInput)
	require.NotNil(t, record.Priority.CacheRead)
	require.NotNil(t, record.PerImage)
	assert.Equal(t, 4.0, *record.Priority.Input)
	assert.Equal(t, 4.0, *record.Flex.Output)
	assert.Equal(t, 4.0, *record.Standard.CacheWrite1h)
	assert.Equal(t, 3.0, *record.Standard.ImageInput)
	assert.Equal(t, 6.0, *record.Standard.AudioInput)
	assert.InDelta(t, 0.4, *record.Priority.CacheRead, 1e-12)
	assert.Equal(t, 0.04, *record.PerImage)
	require.Len(t, record.Tiers, 2)
	assert.Equal(t, 272000, record.Tiers[0].MaxInputTokens)
	assert.Equal(t, 4.0, *record.Tiers[1].Costs.Input)
	assert.Equal(t, 12.0, *record.Tiers[1].Costs.Output)
	assert.InDelta(t, 0.4, *record.Tiers[1].Costs.CacheRead, 1e-12)
	assert.Equal(t, 5.0, *record.Tiers[1].Costs.CacheWrite5m)

	catalog, err := MergeSources(source)
	require.NoError(t, err)
	entry, ok := catalog.Lookup("rich-model")
	require.True(t, ok)
	require.True(t, entry.HasBillingExpr)
	require.True(t, entry.HasPerImagePrice)
	assert.Equal(t, 0.04, entry.PerImagePrice)
	assert.Contains(t, entry.BillingExpr, "ai * 6")
	assert.Contains(t, entry.BillingExpr, "ao * 24")
	assert.Contains(t, entry.BillingExpr, `count("n") * 40000`)
	value, _, err := billingexpr.RunExprWithRequest(entry.BillingExpr, billingexpr.TokenParams{}, billingexpr.RequestInput{Counts: map[string]float64{"n": 3}})
	require.NoError(t, err)
	assert.Equal(t, 120000.0, value)
}

func TestLoadBuiltInOverridesIncludesReviewedPricesAndMetadata(t *testing.T) {
	source, expired, err := LoadBuiltInOverrides(time.Date(2026, 8, 14, 0, 0, 0, 0, time.UTC))
	require.NoError(t, err)
	assert.Empty(t, expired)

	for _, model := range []string{
		"gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna",
		"gpt-5.4", "gpt-5.5", "gemini-2.5-pro", "claude-opus-5",
	} {
		record, ok := source.Records[model]
		require.Truef(t, ok, "missing reviewed override for %s", model)
		assert.Equal(t, SourceOverride, record.PrimarySource)
		assert.NotEmpty(t, record.SourceURL)
		assert.NotEmpty(t, record.Reason)
		assert.False(t, record.ValidUntil.IsZero())
	}

	gpt55 := source.Records["gpt-5.5"]
	require.NotNil(t, gpt55.Standard.Input)
	require.NotNil(t, gpt55.Standard.Output)
	assert.Equal(t, 5.0, *gpt55.Standard.Input)
	assert.Equal(t, 30.0, *gpt55.Standard.Output)

	gpt56 := source.Records["gpt-5.6-sol"]
	require.Len(t, gpt56.Tiers, 2)
	assert.Equal(t, 272000, gpt56.Tiers[0].MaxInputTokens)
	assert.True(t, hasCosts(gpt56.Priority))
	assert.True(t, hasCosts(gpt56.Flex))
}

func TestReviewedOverrideExpressionPricesContextServiceTiersAndCache(t *testing.T) {
	source, _, err := LoadBuiltInOverrides(time.Date(2026, 8, 14, 0, 0, 0, 0, time.UTC))
	require.NoError(t, err)
	catalog, err := MergeSources(source)
	require.NoError(t, err)

	entry, ok := catalog.Lookup("gpt-5.6-sol")
	require.True(t, ok)
	require.True(t, entry.HasBillingExpr)

	run := func(params billingexpr.TokenParams, body string) float64 {
		t.Helper()
		value, _, runErr := billingexpr.RunExprWithRequest(entry.BillingExpr, params, billingexpr.RequestInput{Body: []byte(body)})
		require.NoError(t, runErr)
		return value
	}
	assert.Equal(t, 800.0, run(billingexpr.TokenParams{P: 100, C: 10, Len: 100}, `{}`))
	assert.Equal(t, 1450.0, run(billingexpr.TokenParams{P: 100, C: 10, Len: 300000}, `{}`))
	assert.Equal(t, 1600.0, run(billingexpr.TokenParams{P: 100, C: 10, Len: 100}, `{"service_tier":"priority"}`))
	assert.Equal(t, 1600.0, run(billingexpr.TokenParams{P: 100, C: 10, Len: 100}, `{"service_tier":"fast"}`))
	assert.Equal(t, 400.0, run(billingexpr.TokenParams{P: 100, C: 10, Len: 100}, `{"service_tier":"flex"}`))

	claude, ok := catalog.Lookup("claude-opus-5")
	require.True(t, ok)
	require.True(t, claude.HasBillingExpr)
	value, _, err := billingexpr.RunExprWithRequest(claude.BillingExpr, billingexpr.TokenParams{CC: 100, CC1h: 100}, billingexpr.RequestInput{})
	require.NoError(t, err)
	assert.Equal(t, 1625.0, value)
}

func TestOverrideAliasesResolveWithoutAddingCatchAll(t *testing.T) {
	source, _, err := LoadBuiltInOverrides(time.Date(2026, 8, 14, 0, 0, 0, 0, time.UTC))
	require.NoError(t, err)
	catalog, err := MergeSources(source)
	require.NoError(t, err)
	SetCatalog(catalog)
	t.Cleanup(func() { SetCatalog(nil) })

	alias, ok := Resolve("gpt-5.6", false)
	require.True(t, ok)
	assert.Equal(t, "gpt-5.6-sol", alias.CatalogKey)

	_, ok = Resolve("unknown-future-model", true)
	assert.False(t, ok)
}
