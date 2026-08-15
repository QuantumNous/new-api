package helper

import (
	"testing"

	"github.com/QuantumNous/new-api/pkg/autopricing"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// installExplicitConfigFixture enables the auto-pricing catalog with a single
// "-nothinking" entry and pins self-use mode off, restoring everything after
// the test.
func installExplicitConfigFixture(t *testing.T) {
	t.Helper()

	setting, ok := config.GlobalConfig.Get("auto_pricing").(*ratio_setting.AutoPricingSetting)
	require.True(t, ok, "auto_pricing config must be registered")
	previousSetting := *setting
	setting.Enabled = true
	setting.FuzzyMatchEnabled = true

	previousSelfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = false

	catalog, err := autopricing.BuildCatalog([]byte(`{
		"gemini-9.9-flash-nothinking": {"input_cost_per_token": 0.000001, "output_cost_per_token": 0.000004}
	}`), "test")
	require.NoError(t, err)
	autopricing.SetCatalog(catalog)

	t.Cleanup(func() {
		*setting = previousSetting
		operation_setting.SelfUseModeEnabled = previousSelfUse
		autopricing.SetCatalog(nil)
	})
}

// A catalog entry for a variant billing name must make the variant billable
// without counting as operator configuration: HasExplicitModelBillingConfig
// drives the Gemini "-nothinking" billing-name rewrite, and a rewrite driven by
// the catalog would move a manually priced base model onto catalog pricing.
func TestExplicitBillingConfigIgnoresAutoPricingCatalog(t *testing.T) {
	installExplicitConfigFixture(t)

	const variant = "gemini-9.9-flash-nothinking"

	assert.True(t, HasModelBillingConfig(variant),
		"the catalog must keep the variant billable")
	assert.False(t, HasExplicitModelBillingConfig(variant),
		"a catalog entry must not count as operator configuration")
}

func TestExplicitBillingConfigHonorsManualEntries(t *testing.T) {
	installExplicitConfigFixture(t)
	ratio_setting.InitRatioSettings()

	// gpt-4o ships in the built-in manual ratio table.
	assert.True(t, HasExplicitModelBillingConfig("gpt-4o"))
	assert.False(t, HasExplicitModelBillingConfig("model-nobody-has-heard-of"))
}

func TestExplicitBillingConfigHonorsSelfUseMode(t *testing.T) {
	installExplicitConfigFixture(t)

	operation_setting.SelfUseModeEnabled = true
	// Self-use mode has always meant "everything is billable"; the explicit
	// check keeps that historical behavior.
	assert.True(t, HasExplicitModelBillingConfig("model-nobody-has-heard-of"))
}
