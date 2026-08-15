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

func TestParseModelsDevSourceUsesCheapestProviderWithStableTieBreak(t *testing.T) {
	source, err := ParseModelsDevSource([]byte(`{
		"xpersona": {"models": {"gpt-5.6-sol": {"cost": {"input": 1.5, "output": 12}}}},
		"openai": {"models": {"gpt-5.6-sol": {"cost": {"input": 5, "output": 30, "cache_read": 0.5}}}}
	}`), "models-dev-v1")
	require.NoError(t, err)

	record, ok := source.Records["gpt-5.6-sol"]
	require.True(t, ok)
	assert.Equal(t, "xpersona", record.Provider)
	require.NotNil(t, record.Standard.Input)
	require.NotNil(t, record.Standard.Output)
	assert.Equal(t, 1.5, *record.Standard.Input)
	assert.Equal(t, 12.0, *record.Standard.Output)
}

func TestParseModelsDevSourcePreservesFreeModelFields(t *testing.T) {
	source, err := ParseModelsDevSource([]byte(`{
		"openai": {"models": {"free-model": {"cost": {"input": 0, "output": 0}}}}
	}`), "models-dev-free")
	require.NoError(t, err)
	entry, ok := source.Records["free-model"]
	require.True(t, ok)
	catalogEntry := recordToEntry(entry)
	assert.True(t, catalogEntry.HasModelRatio)
	assert.True(t, catalogEntry.HasCompletionRatio)
	assert.Equal(t, 1.0, catalogEntry.CompletionRatio)
}

func TestMergeSourcesUsesFieldPrecedenceAndLowerSourceFill(t *testing.T) {
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
	assert.Equal(t, SourceNewAPI, entry.Source)
	assert.Equal(t, 2.5, entry.ModelRatio)
	assert.Equal(t, 6.0, entry.CompletionRatio)
	assert.True(t, entry.HasCreateCacheRatio)
	assert.Equal(t, 1.25, entry.CreateCacheRatio)
	assert.Equal(t, SourceLiteLLM, entry.FieldSources[FieldCacheWrite5m])
	assert.Equal(t, SourceNewAPI, entry.FieldSources[FieldBillingExpr])
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
			"input_cost_per_token_flex": 0.000001,
			"output_cost_per_token_flex": 0.000004,
			"input_cost_per_image_token": 0.000003,
			"output_cost_per_image_token": 0.000012,
			"output_cost_per_image": 0.04,
			"input_cost_per_token_above_200k_tokens": 0.000004,
			"output_cost_per_token_above_200k_tokens": 0.000012
		}
	}`), "litellm-rich")
	require.NoError(t, err)

	record := source.Records["rich-model"]
	require.NotNil(t, record.Priority.Input)
	require.NotNil(t, record.Flex.Output)
	require.NotNil(t, record.Standard.CacheWrite1h)
	require.NotNil(t, record.Standard.ImageInput)
	require.NotNil(t, record.PerRequest)
	assert.Equal(t, 4.0, *record.Priority.Input)
	assert.Equal(t, 4.0, *record.Flex.Output)
	assert.Equal(t, 4.0, *record.Standard.CacheWrite1h)
	assert.Equal(t, 3.0, *record.Standard.ImageInput)
	assert.Equal(t, 0.04, *record.PerRequest)
	require.Len(t, record.Tiers, 2)
	assert.Equal(t, 200000, record.Tiers[0].MaxInputTokens)
	assert.Equal(t, 4.0, *record.Tiers[1].Costs.Input)
	assert.Equal(t, 12.0, *record.Tiers[1].Costs.Output)
}

func TestParseLiteLLMSourceSkipsOutputOnlyTokenEntries(t *testing.T) {
	source, err := ParseLiteLLMSource([]byte(`{
		"output-only": {"output_cost_per_token": 0.000008},
		"token-model": {"input_cost_per_token": 0.000002, "output_cost_per_token": 0.000008}
	}`), "litellm-token")
	require.NoError(t, err)
	_, ok := source.Records["output-only"]
	assert.False(t, ok)
	_, ok = source.Records["token-model"]
	assert.True(t, ok)
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
