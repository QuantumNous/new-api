package model

import (
	"errors"
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupModelPricingTest(t *testing.T) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	common.OptionMapRWMutex.Unlock()
	require.NoError(t, DB.AutoMigrate(&Option{}))
	require.NoError(t, DB.Where("key IN ?", append(pricingOptionKeys, ModelPricingRevisionKey)).Delete(&Option{}).Error)
	original := currentPricingValues()
	t.Cleanup(func() {
		for key, value := range original {
			require.NoError(t, updateOptionMap(key, value))
		}
		require.NoError(t, updateOptionMap(ModelPricingRevisionKey, "0"))
		DB.Where("key IN ?", append(pricingOptionKeys, ModelPricingRevisionKey)).Delete(&Option{})
	})
	for _, key := range pricingOptionKeys {
		require.NoError(t, updateOptionMap(key, "{}"))
	}
	require.NoError(t, updateOptionMap(ModelPricingRevisionKey, "0"))
}

func floatPointer(value float64) *float64 { return &value }
func stringPointer(value string) *string  { return &value }

func addPricingAbilities(t *testing.T, models ...string) {
	t.Helper()
	const channelID = 987654321
	abilities := make([]Ability, 0, len(models))
	for _, modelName := range models {
		abilities = append(abilities, Ability{Group: "pricing-test", Model: modelName, ChannelId: channelID, Enabled: true})
	}
	require.NoError(t, DB.Create(&abilities).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Where("channel_id = ?", channelID).Delete(&Ability{}).Error)
	})
}

func TestModelPricingReplacementAndExactZeroRoundTrip(t *testing.T) {
	setupModelPricingTest(t)
	addPricingAbilities(t, "zero-model", "request-model", "tiered-model")
	revision, err := ReplaceModelPricing(0, []ModelPricingUpdate{{ModelName: "zero-model", Pricing: ModelPricing{
		Mode: "per-token", ModelRatio: floatPointer(0), CompletionRatio: floatPointer(0), CacheRatio: floatPointer(0),
	}}})
	require.NoError(t, err)
	assert.Equal(t, int64(1), revision)

	_, rows, err := GetModelPricingRows()
	require.NoError(t, err)
	var zeroRow ModelPricingRow
	for _, row := range rows {
		if row.ModelName == "zero-model" {
			zeroRow = row
		}
	}
	require.NotNil(t, zeroRow.Pricing.ModelRatio)
	assert.Zero(t, *zeroRow.Pricing.ModelRatio)
	require.NotNil(t, zeroRow.Pricing.CompletionRatio)
	assert.Zero(t, *zeroRow.Pricing.CompletionRatio)
	require.NotNil(t, zeroRow.Pricing.CacheRatio)
	assert.Zero(t, *zeroRow.Pricing.CacheRatio)

	revision, err = ReplaceModelPricing(revision, []ModelPricingUpdate{
		{ModelName: "request-model", Pricing: ModelPricing{Mode: "per-request", ModelPrice: floatPointer(0.25)}},
		{ModelName: "tiered-model", Pricing: ModelPricing{Mode: "tiered_expr", ModelRatio: floatPointer(2), BillingExpr: stringPointer(`tier("base", p * 2 + c * 4)`)}},
	})
	require.NoError(t, err)
	assert.Equal(t, int64(2), revision)

	revision, err = ReplaceModelPricing(revision, []ModelPricingUpdate{{ModelName: "request-model", Pricing: ModelPricing{Mode: "unset"}}})
	require.NoError(t, err)
	var prices map[string]float64
	require.NoError(t, common.UnmarshalJsonStr(optionValueForTest(t, "ModelPrice"), &prices))
	_, exists := prices["request-model"]
	assert.False(t, exists)
	var ratios map[string]float64
	require.NoError(t, common.UnmarshalJsonStr(optionValueForTest(t, "ModelRatio"), &ratios))
	assert.Equal(t, float64(2), ratios["tiered-model"], "tiered numeric fallback must be retained")
}

func TestModelPricingConflictPreservesUnrelatedKeys(t *testing.T) {
	setupModelPricingTest(t)
	addPricingAbilities(t, "target")
	require.NoError(t, UpdateOption("ModelRatio", `{"other":7}`))
	revision, err := GetModelPricingRevision()
	require.NoError(t, err)
	next, err := ReplaceModelPricing(revision, []ModelPricingUpdate{{ModelName: "target", Pricing: ModelPricing{Mode: "per-token", ModelRatio: floatPointer(1)}}})
	require.NoError(t, err)
	before := optionValueForTest(t, "ModelRatio")
	_, err = ReplaceModelPricing(revision, []ModelPricingUpdate{{ModelName: "target", Pricing: ModelPricing{Mode: "unset"}}})
	var conflict *PricingRevisionConflict
	require.True(t, errors.As(err, &conflict))
	assert.Equal(t, next, conflict.CurrentRevision)
	assert.Equal(t, before, optionValueForTest(t, "ModelRatio"))
	var ratios map[string]float64
	require.NoError(t, common.UnmarshalJsonStr(before, &ratios))
	assert.Equal(t, float64(7), ratios["other"])
}

func TestModelPricingUnsetPreservesWildcardAndHidesItFromCatalog(t *testing.T) {
	setupModelPricingTest(t)
	addPricingAbilities(t, "target")
	require.NoError(t, UpdateOption("ModelRatio", `{"gpt-4-gizmo-*":15,"target":2}`))
	revision, rows, err := GetModelPricingRows()
	require.NoError(t, err)
	var target *ModelPricingRow
	for i := range rows {
		assert.NotEqual(t, "gpt-4-gizmo-*", rows[i].ModelName)
		if rows[i].ModelName == "target" {
			target = &rows[i]
		}
	}
	require.NotNil(t, target)
	assert.True(t, target.Configured)
	assert.Equal(t, "per-token", target.Pricing.Mode)
	require.NotNil(t, target.Pricing.ModelRatio)
	assert.Equal(t, float64(2), *target.Pricing.ModelRatio)

	_, err = ReplaceModelPricing(revision, []ModelPricingUpdate{{ModelName: "target", Pricing: ModelPricing{Mode: "unset"}}})
	require.NoError(t, err)
	var ratios map[string]float64
	require.NoError(t, common.UnmarshalJsonStr(optionValueForTest(t, "ModelRatio"), &ratios))
	assert.Equal(t, float64(15), ratios["gpt-4-gizmo-*"])
	assert.NotContains(t, ratios, "target")
}

func TestModelPricingValidationAndCompletionLock(t *testing.T) {
	setupModelPricingTest(t)
	addPricingAbilities(t, "gpt-4.5-preview", "ordinary-model", "o1-new-locked")
	tests := []ModelPricingUpdate{
		{ModelName: "negative", Pricing: ModelPricing{Mode: "per-token", ModelRatio: floatPointer(-1)}},
		{ModelName: "nan", Pricing: ModelPricing{Mode: "per-token", ModelRatio: floatPointer(math.NaN())}},
		{ModelName: "bad-expr", Pricing: ModelPricing{Mode: "tiered_expr", BillingExpr: stringPointer("not valid +")}},
		{ModelName: "missing", Pricing: ModelPricing{Mode: "per-request"}},
	}
	for _, update := range tests {
		assert.Error(t, ValidateModelPricingUpdates([]ModelPricingUpdate{update}), update.ModelName)
	}
	assert.Error(t, ValidateModelPricingUpdates([]ModelPricingUpdate{{ModelName: "same", Pricing: ModelPricing{Mode: "unset"}}, {ModelName: "same", Pricing: ModelPricing{Mode: "unset"}}}))

	require.NoError(t, UpdateOption("CompletionRatio", `{"gpt-4.5-preview":2}`))
	revision, err := GetModelPricingRevision()
	require.NoError(t, err)
	revision, err = ReplaceModelPricing(revision, []ModelPricingUpdate{{ModelName: "gpt-4.5-preview", Pricing: ModelPricing{Mode: "per-token", ModelRatio: floatPointer(1), CompletionRatio: floatPointer(2)}}})
	require.NoError(t, err, "unchanged explicit locked value is allowed")
	revision, err = ReplaceModelPricing(revision, []ModelPricingUpdate{
		{ModelName: "gpt-4.5-preview", Pricing: ModelPricing{Mode: "per-token", ModelRatio: floatPointer(1), CompletionRatio: floatPointer(3)}},
		{ModelName: "ordinary-model", Pricing: ModelPricing{Mode: "per-token", ModelRatio: floatPointer(5), CompletionRatio: floatPointer(6)}},
	})
	require.NoError(t, err, "locked values are ignored instead of poisoning a bulk update")
	var completionRatios map[string]float64
	require.NoError(t, common.UnmarshalJsonStr(optionValueForTest(t, "CompletionRatio"), &completionRatios))
	assert.Equal(t, float64(2), completionRatios["gpt-4.5-preview"])
	assert.Equal(t, float64(6), completionRatios["ordinary-model"])

	revision, err = ReplaceModelPricing(revision, []ModelPricingUpdate{{ModelName: "gpt-4.5-preview", Pricing: ModelPricing{Mode: "unset"}}})
	require.NoError(t, err)
	require.NoError(t, common.UnmarshalJsonStr(optionValueForTest(t, "CompletionRatio"), &completionRatios))
	assert.Equal(t, float64(2), completionRatios["gpt-4.5-preview"], "unset must preserve locked completion ratios")
	var modelRatios map[string]float64
	require.NoError(t, common.UnmarshalJsonStr(optionValueForTest(t, "ModelRatio"), &modelRatios))
	assert.NotContains(t, modelRatios, "gpt-4.5-preview")
	assert.Equal(t, float64(5), modelRatios["ordinary-model"])
	_, rows, err := GetModelPricingRows()
	require.NoError(t, err)
	foundLockedRow := false
	for _, row := range rows {
		if row.ModelName == "gpt-4.5-preview" {
			foundLockedRow = true
			require.NotNil(t, row.Pricing.CompletionRatio)
			assert.Equal(t, float64(2), *row.Pricing.CompletionRatio)
			assert.True(t, row.CompletionRatioLocked)
		}
	}
	require.True(t, foundLockedRow)

	_, err = ReplaceModelPricing(revision, []ModelPricingUpdate{{ModelName: "o1-new-locked", Pricing: ModelPricing{Mode: "per-token", ModelRatio: floatPointer(1), CompletionRatio: floatPointer(4)}}})
	require.NoError(t, err)
	require.NoError(t, common.UnmarshalJsonStr(optionValueForTest(t, "CompletionRatio"), &completionRatios))
	assert.NotContains(t, completionRatios, "o1-new-locked")
}

func TestModelPricingCatalogOnlyIncludesEnabledChannelModels(t *testing.T) {
	setupModelPricingTest(t)
	addPricingAbilities(t, "enabled-channel-model")
	require.NoError(t, DB.Create(&Ability{Group: "pricing-test", Model: "disabled-channel-model", ChannelId: 987654322, Enabled: false}).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Where("channel_id = ?", 987654322).Delete(&Ability{}).Error)
	})
	require.NoError(t, UpdateOption("ModelRatio", `{"enabled-channel-model":1,"disabled-channel-model":2,"price-only-model":3}`))

	_, rows, err := GetModelPricingRows()
	require.NoError(t, err)
	rowNames := make([]string, 0, len(rows))
	for _, row := range rows {
		rowNames = append(rowNames, row.ModelName)
	}
	assert.Contains(t, rowNames, "enabled-channel-model")
	assert.NotContains(t, rowNames, "disabled-channel-model")
	assert.NotContains(t, rowNames, "price-only-model")

	_, err = ReplaceModelPricing(1, []ModelPricingUpdate{{ModelName: "price-only-model", Pricing: ModelPricing{Mode: "per-token", ModelRatio: floatPointer(1)}}})
	assert.ErrorContains(t, err, "has no enabled channel")
}

func TestGenericPricingOptionWriteIncrementsRevision(t *testing.T) {
	setupModelPricingTest(t)
	require.NoError(t, UpdateOption("ModelPrice", `{"generic":1}`))
	revision, err := GetModelPricingRevision()
	require.NoError(t, err)
	assert.Equal(t, int64(1), revision)
	assert.JSONEq(t, `{"generic":1}`, optionValueForTest(t, "ModelPrice"))
}

func optionValueForTest(t *testing.T, key string) string {
	t.Helper()
	var option Option
	require.NoError(t, DB.Where("key = ?", key).First(&option).Error)
	return option.Value
}
