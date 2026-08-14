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
		"output_cost_per_token": 0.0009
	}
}`

func TestManualRatioAlwaysWinsOverCatalog(t *testing.T) {
	useTestCatalog(t, testCatalogDocument, enabledAutoPricing())
	withManualRatio(t, "manually-priced-model", 1.5)

	ratio, ok, _ := GetModelRatio("manually-priced-model")
	require.True(t, ok)
	assert.Equal(t, 1.5, ratio, "an administrator ratio must not be replaced by the catalog")

	// The catalog publishes both a cache read and a cache creation cost for
	// this model, but a manually priced model must keep the built-in defaults.
	cacheRatio, cacheOK := GetCacheRatio("manually-priced-model")
	assert.False(t, cacheOK)
	assert.Equal(t, 1.0, cacheRatio)
}

func TestManualFixedPriceSuppressesCatalogRatio(t *testing.T) {
	useTestCatalog(t, testCatalogDocument, enabledAutoPricing())
	withManualPrice(t, "manually-priced-model", 0.05)

	// A per-call priced model has no ratio on purpose; the catalog must not
	// invent one and turn it into a token-billed model.
	_, ok, _ := GetModelRatio("manually-priced-model")
	assert.False(t, ok)
}

func TestConfiguredCompletionRatioAlwaysWins(t *testing.T) {
	InitRatioSettings()
	useTestCatalog(t, "{\"gpt-4o\": {\"input_cost_per_token\": 0.0001, \"output_cost_per_token\": 0.0004}}", enabledAutoPricing())

	previous := configuredCompletionRatioMap.ReadAll()
	configuredCompletionRatioMap.Set("gpt-4o", 1.75)
	t.Cleanup(func() {
		configuredCompletionRatioMap.Clear()
		configuredCompletionRatioMap.AddAll(previous)
	})

	assert.Equal(t, 1.75, GetCompletionRatio("gpt-4o"),
		"an administrator completion ratio must override both the catalog and hard-coded compatibility values")
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

func TestCatalogWithoutCacheCostUsesInputPriceSemantics(t *testing.T) {
	useTestCatalog(t, testCatalogDocument, enabledAutoPricing())

	ratio, ok, _ := GetModelRatio("auto-no-cache-model")
	require.True(t, ok)
	assert.Equal(t, 1.0, ratio)

	// A missing cache price means ordinary input pricing. It must not fall back
	// to the legacy generic cache-write surcharge.
	cacheRatio, cacheOK := GetCacheRatio("auto-no-cache-model")
	assert.True(t, cacheOK)
	assert.Equal(t, 1.0, cacheRatio)

	createCacheRatio, createOK := GetCreateCacheRatio("auto-no-cache-model")
	assert.True(t, createOK)
	assert.Equal(t, 1.0, createCacheRatio)
}

func TestImageOnlyCatalogEntryDoesNotBecomeZeroTokenRatio(t *testing.T) {
	useTestCatalog(t, `{"image-only":{"output_cost_per_image":0.04}}`, enabledAutoPricing())

	_, ratioOK, _ := GetModelRatio("image-only")
	assert.False(t, ratioOK)
	price, priceOK := GetAutoPerCallPrice("image-only")
	require.True(t, priceOK)
	assert.Equal(t, 0.04, price)
	expr, exprOK := GetAutoBillingExpr("image-only")
	assert.True(t, exprOK)
	assert.Contains(t, expr, `count("n")`)
}

func TestDisabledAutoPricingRestoresLegacyBehavior(t *testing.T) {
	setting := enabledAutoPricing()
	setting.Enabled = false
	useTestCatalog(t, testCatalogDocument, setting)

	ratio, ok, _ := GetModelRatio("auto-only-model")
	assert.False(t, ok, "with the feature off an unconfigured model stays unpriced")
	assert.Equal(t, 0.0, ratio)

	cacheRatio, cacheOK := GetCacheRatio("auto-only-model")
	assert.False(t, cacheOK)
	assert.Equal(t, 1.0, cacheRatio)
}

func TestUnknownModelStaysUnpricedWithCatalogLoaded(t *testing.T) {
	useTestCatalog(t, testCatalogDocument, enabledAutoPricing())

	ratio, ok, _ := GetModelRatio("model-nobody-has-heard-of")
	assert.False(t, ok)
	assert.Equal(t, 0.0, ratio)

	value, usePrice, exists := GetModelRatioOrPrice("model-nobody-has-heard-of")
	assert.False(t, exists)
	assert.False(t, usePrice)
	assert.Equal(t, 0.0, value)
}

func TestConfiguredCompactWildcardWinsOverCatalog(t *testing.T) {
	InitRatioSettings()
	useTestCatalog(t, `{"vendor/model-openai-compact": {"input_cost_per_token": 0.000004, "output_cost_per_token": 0.00002}}`, enabledAutoPricing())

	previousRatios := configuredModelRatioMap.ReadAll()
	configuredModelRatioMap.Set(CompactWildcardModelKey, 3.25)
	t.Cleanup(func() {
		configuredModelRatioMap.Clear()
		configuredModelRatioMap.AddAll(previousRatios)
	})

	ratio, ok, _ := GetModelRatio("vendor/model-openai-compact")
	require.True(t, ok)
	assert.Equal(t, 3.25, ratio)
}

func TestConfiguredRatioWinsOverBuiltInFixedPrice(t *testing.T) {
	InitRatioSettings()
	previousRatios := configuredModelRatioMap.ReadAll()
	configuredModelRatioMap.Set("gpt-4-gizmo-*", 7.5)
	t.Cleanup(func() {
		configuredModelRatioMap.Clear()
		configuredModelRatioMap.AddAll(previousRatios)
	})

	value, usePrice, exists := GetModelRatioOrPrice("gpt-4-gizmo-custom-abc")
	require.True(t, exists)
	assert.False(t, usePrice, "administrator ratio must suppress the built-in fixed-price fallback")
	assert.Equal(t, 7.5, value)
}

func TestCatalogTakesOverBuiltInDefaults(t *testing.T) {
	InitRatioSettings()
	// Shipped defaults are compatibility fallbacks, not administrator intent.
	// A loaded catalog therefore takes ownership of the model.
	useTestCatalog(t, `{"gpt-4o": {"input_cost_per_token": 0.0001, "output_cost_per_token": 0.0004, "cache_read_input_token_cost": 0.00002}}`, enabledAutoPricing())

	ratio, ok, _ := GetModelRatio("gpt-4o")
	require.True(t, ok)
	assert.Equal(t, 50.0, ratio)
	assert.Equal(t, 4.0, GetCompletionRatio("gpt-4o"))
	cacheRatio, cacheOK := GetCacheRatio("gpt-4o")
	require.True(t, cacheOK)
	assert.Equal(t, 0.2, cacheRatio)
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

func TestReviewedGPT56CompatibilityPricesStayPinned(t *testing.T) {
	assert.Equal(t, 2.5, GetDefaultModelRatioMap()["gpt-5.6-sol"])
	assert.Equal(t, 1.0, GetDefaultModelRatioMap()["gpt-5.6-terra"])
	assert.Equal(t, 0.1, GetDefaultModelRatioMap()["gpt-5.6-luna"])
	assert.Equal(t, 0.1, defaultCacheRatio["gpt-5.6-sol"])
	assert.Equal(t, 0.1, defaultCacheRatio["gpt-5.6-terra"])
	assert.Equal(t, 0.1, defaultCacheRatio["gpt-5.6-luna"])
	assert.Equal(t, 6.0, GetCompletionRatio("gpt-5.6-terra"))
	assert.Equal(t, 6.0, GetCompletionRatio("gpt-5.6-luna"))
}
