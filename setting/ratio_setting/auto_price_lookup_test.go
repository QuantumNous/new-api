package ratio_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/pkg/autopricing"
	"github.com/QuantumNous/new-api/types"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// useTestCatalog installs a catalog and the auto-pricing setting for one test,
// restoring both afterwards.
func useTestCatalog(t *testing.T, document string, setting AutoPricingSetting) {
	t.Helper()

	catalog, err := autopricing.BuildCatalog([]byte(document), "test")
	require.NoError(t, err)

	previous := autoPricingSetting
	autoPricingSetting = setting
	autopricing.SetCatalog(catalog)
	t.Cleanup(func() {
		autoPricingSetting = previous
		autopricing.SetCatalog(nil)
	})
}

func enabledAutoPricing() AutoPricingSetting {
	return AutoPricingSetting{
		Enabled:              true,
		RemoteURL:            DefaultAutoPricingRemoteURL,
		CheckIntervalMinutes: 60,
		FuzzyMatchEnabled:    true,
	}
}

// withManualEntry adds a manual pricing entry for one test. RWMap has no
// single-key delete, so the whole map is snapshotted and restored.
func withManualEntry(t *testing.T, target *types.RWMap[string, float64], model string, value float64) {
	t.Helper()
	snapshot := target.ReadAll()
	target.Set(model, value)
	t.Cleanup(func() {
		target.Clear()
		target.AddAll(snapshot)
	})
}

func withManualRatio(t *testing.T, model string, ratio float64) {
	t.Helper()
	withManualEntry(t, modelRatioMap, model, ratio)
}

func withManualPrice(t *testing.T, model string, price float64) {
	t.Helper()
	withManualEntry(t, modelPriceMap, model, price)
}

func withManualCompletionRatio(t *testing.T, model string, ratio float64) {
	t.Helper()
	withManualEntry(t, completionRatioMap, model, ratio)
}

func withManualCacheRatio(t *testing.T, model string, ratio float64) {
	t.Helper()
	withManualEntry(t, cacheRatioMap, model, ratio)
}

func withManualCreateCacheRatio(t *testing.T, model string, ratio float64) {
	t.Helper()
	withManualEntry(t, createCacheRatioMap, model, ratio)
}

const testCatalogDocument = `{
	"auto-only-model": {
		"input_cost_per_token": 0.000004,
		"output_cost_per_token": 0.00002,
		"cache_read_input_token_cost": 0.0000004,
		"cache_creation_input_token_cost": 0.000005
	},
	"auto-no-cache-model": {
		"input_cost_per_token": 0.000002,
		"output_cost_per_token": 0.000008
	},
	"manually-priced-model": {
		"input_cost_per_token": 0.00009,
		"output_cost_per_token": 0.0009,
		"cache_read_input_token_cost": 0.000009,
		"cache_creation_input_token_cost": 0.00018
	}
}`

func TestManualBaseRatioOnlyOverridesCatalogBaseRatio(t *testing.T) {
	useTestCatalog(t, testCatalogDocument, enabledAutoPricing())
	withManualRatio(t, "manually-priced-model", 1.5)

	ratio, ok, _ := GetModelRatio("manually-priced-model")
	require.True(t, ok)
	assert.Equal(t, 1.5, ratio, "an administrator ratio must not be replaced by the catalog")

	assert.Equal(t, 10.0, GetCompletionRatio("manually-priced-model"))

	cacheRatio, cacheOK := GetCacheRatio("manually-priced-model")
	require.True(t, cacheOK)
	assert.Equal(t, 0.1, cacheRatio)

	createCacheRatio, createCacheOK := GetCreateCacheRatio("manually-priced-model")
	require.True(t, createCacheOK)
	assert.Equal(t, 2.0, createCacheRatio)
}

func TestManualFixedPriceSuppressesCatalogRatio(t *testing.T) {
	useTestCatalog(t, testCatalogDocument, enabledAutoPricing())
	withManualPrice(t, "manually-priced-model", 0.05)

	// A per-call priced model has no ratio on purpose; the catalog must not
	// invent one and turn it into a token-billed model.
	_, ok, _ := GetModelRatio("manually-priced-model")
	assert.False(t, ok)
	assert.Equal(t, 1.0, GetCompletionRatio("manually-priced-model"))
	cacheRatio, cacheOK := GetCacheRatio("manually-priced-model")
	assert.False(t, cacheOK)
	assert.Equal(t, 1.0, cacheRatio)
	createCacheRatio, createCacheOK := GetCreateCacheRatio("manually-priced-model")
	assert.False(t, createCacheOK)
	assert.Equal(t, 1.25, createCacheRatio)
}

func TestManualCompactWildcardOnlyOverridesCatalogBaseRatio(t *testing.T) {
	useTestCatalog(t, `{
		"gpt-compact-model-openai-compact": {
			"input_cost_per_token": 0.000002,
			"output_cost_per_token": 0.000018
		}
	}`, enabledAutoPricing())
	withManualRatio(t, CompactWildcardModelKey, 7)

	ratio, ok, _ := GetModelRatio("gpt-compact-model-openai-compact")
	require.True(t, ok)
	assert.Equal(t, 7.0, ratio)
	assert.Equal(t, 9.0, GetCompletionRatio("gpt-compact-model-openai-compact"))
}

func TestManualFieldOverridesWinOverCatalogFields(t *testing.T) {
	useTestCatalog(t, testCatalogDocument, enabledAutoPricing())
	withManualCompletionRatio(t, "manually-priced-model", 3)
	withManualCacheRatio(t, "manually-priced-model", 0.25)
	withManualCreateCacheRatio(t, "manually-priced-model", 1.5)

	assert.Equal(t, 3.0, GetCompletionRatio("manually-priced-model"))
	cacheRatio, cacheOK := GetCacheRatio("manually-priced-model")
	require.True(t, cacheOK)
	assert.Equal(t, 0.25, cacheRatio)
	createCacheRatio, createCacheOK := GetCreateCacheRatio("manually-priced-model")
	require.True(t, createCacheOK)
	assert.Equal(t, 1.5, createCacheRatio)
}

func TestCatalogPricesModelsWithoutManualConfig(t *testing.T) {
	useTestCatalog(t, testCatalogDocument, enabledAutoPricing())

	ratio, ok, matchName := GetModelRatio("auto-only-model")
	require.True(t, ok, "an unconfigured model present in the catalog must be usable")
	assert.Equal(t, 2.0, ratio)
	assert.Equal(t, "auto-only-model", matchName)

	assert.Equal(t, 5.0, GetCompletionRatio("auto-only-model"))

	cacheRatio, cacheOK := GetCacheRatio("auto-only-model")
	require.True(t, cacheOK)
	assert.Equal(t, 0.1, cacheRatio)

	createCacheRatio, createOK := GetCreateCacheRatio("auto-only-model")
	require.True(t, createOK)
	assert.Equal(t, 1.25, createCacheRatio)
}

func TestCatalogWithoutCacheCostKeepsDefaults(t *testing.T) {
	useTestCatalog(t, testCatalogDocument, enabledAutoPricing())

	ratio, ok, _ := GetModelRatio("auto-no-cache-model")
	require.True(t, ok)
	assert.Equal(t, 1.0, ratio)

	// A silent catalog must not make cached tokens free.
	cacheRatio, cacheOK := GetCacheRatio("auto-no-cache-model")
	assert.False(t, cacheOK)
	assert.Equal(t, 1.0, cacheRatio)

	createCacheRatio, createOK := GetCreateCacheRatio("auto-no-cache-model")
	assert.False(t, createOK)
	assert.Equal(t, 1.25, createCacheRatio)
}

func TestDisabledAutoPricingRestoresLegacyBehavior(t *testing.T) {
	setting := enabledAutoPricing()
	setting.Enabled = false
	useTestCatalog(t, testCatalogDocument, setting)

	ratio, ok, _ := GetModelRatio("auto-only-model")
	assert.False(t, ok, "with the feature off an unconfigured model stays unpriced")
	assert.Equal(t, 37.5, ratio)

	cacheRatio, cacheOK := GetCacheRatio("auto-only-model")
	assert.False(t, cacheOK)
	assert.Equal(t, 1.0, cacheRatio)
}

func TestUnknownModelStaysUnpricedWithCatalogLoaded(t *testing.T) {
	useTestCatalog(t, testCatalogDocument, enabledAutoPricing())

	ratio, ok, _ := GetModelRatio("model-nobody-has-heard-of")
	assert.False(t, ok)
	assert.Equal(t, 37.5, ratio)
}

func TestBuiltInDefaultsAreUnaffectedByCatalog(t *testing.T) {
	InitRatioSettings()
	// The catalog prices gpt-4o far above its real rate; the shipped default
	// must still win because it is manual configuration.
	useTestCatalog(t, `{"gpt-4o": {"input_cost_per_token": 0.0001, "output_cost_per_token": 0.0004}}`, enabledAutoPricing())

	ratio, ok, _ := GetModelRatio("gpt-4o")
	require.True(t, ok)
	assert.Equal(t, 1.25, ratio)
	assert.Equal(t, 4.0, GetCompletionRatio("gpt-4o"))
}

func TestExactBuiltInModelsReceiveAutomaticCachePricing(t *testing.T) {
	InitRatioSettings()
	useTestCatalog(t, `{
		"gpt-5.5": {
			"input_cost_per_token": 0.000005,
			"output_cost_per_token": 0.00003,
			"cache_read_input_token_cost": 0.0000005
		},
		"gpt-5.6-sol": {
			"input_cost_per_token": 0.000005,
			"output_cost_per_token": 0.00003,
			"cache_read_input_token_cost": 0.0000005
		}
	}`, enabledAutoPricing())

	for _, name := range []string{"gpt-5.5", "gpt-5.6-sol"} {
		ratio, ok, _ := GetModelRatio(name)
		require.True(t, ok)
		assert.Equal(t, 2.5, ratio, name)
		cacheRatio, cacheOK := GetCacheRatio(name)
		require.True(t, cacheOK, name)
		assert.Equal(t, 0.1, cacheRatio, name)
	}

	createCacheRatio, createCacheOK := GetCreateCacheRatio("gpt-5.6-sol")
	require.True(t, createCacheOK)
	assert.Equal(t, 1.25, createCacheRatio)
}

func TestCatalogNeverLeaksIntoExportedManualMaps(t *testing.T) {
	InitRatioSettings()
	useTestCatalog(t, testCatalogDocument, enabledAutoPricing())

	// Automatic prices must stay out of everything that feeds Options
	// persistence and the manual ratio sync UI.
	assert.NotContains(t, GetModelRatioCopy(), "auto-only-model")
	assert.NotContains(t, GetCompletionRatioCopy(), "auto-only-model")
	assert.NotContains(t, GetCacheRatioCopy(), "auto-only-model")
	assert.NotContains(t, GetCreateCacheRatioCopy(), "auto-only-model")
	assert.NotContains(t, ModelRatio2JSONString(), "auto-only-model")
}

func TestHasManualModelRatioIgnoresCatalog(t *testing.T) {
	useTestCatalog(t, testCatalogDocument, enabledAutoPricing())
	withManualRatio(t, "manually-priced-model", 1.5)

	assert.True(t, HasManualModelRatio("manually-priced-model"))

	// The catalog prices this model, but that must not make it "manually
	// priced": callers rewrite billing names based on this answer.
	assert.False(t, HasManualModelRatio("auto-only-model"))

	ratio, ok, _ := GetModelRatio("auto-only-model")
	require.True(t, ok, "the same model must still be billable through the catalog")
	assert.Equal(t, 2.0, ratio)
}

func TestHasManualModelRatioAppliesNameNormalization(t *testing.T) {
	InitRatioSettings()
	// gpt-4-gizmo-* is a built-in wildcard entry; the concrete name must be
	// normalized onto it exactly like GetModelRatio does.
	assert.True(t, HasManualModelRatio("gpt-4-gizmo-custom-abc"))
	assert.False(t, HasManualModelRatio("model-nobody-has-heard-of"))
}

// TestRatioUnitMatchesRatioSetting pins the ratio unit that pkg/autopricing
// converts into. That package cannot import this one, so the shared definition
// is asserted here instead: USD = 500 means $1 buys 500 units, so one unit is
// $0.002 per 1K tokens, i.e. $2 per 1M tokens.
func TestRatioUnitMatchesRatioSetting(t *testing.T) {
	const oneUnitUSDPerMillionTokens = 1_000_000.0 / (USD * 1000)
	assert.Equal(t, 2.0, oneUnitUSDPerMillionTokens)

	catalog, err := autopricing.BuildCatalog(
		[]byte(`{"probe": {"input_cost_per_token": 0.000002, "output_cost_per_token": 0.000002}}`), "test")
	require.NoError(t, err)
	entry, ok := catalog.Lookup("probe")
	require.True(t, ok)
	assert.Equal(t, 1.0, entry.ModelRatio, "$2 per 1M tokens must convert to exactly one ratio unit")
}
