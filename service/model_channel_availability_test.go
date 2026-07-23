package service

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func resetModelChannelAvailabilityFixtures(t *testing.T) {
	t.Helper()
	for _, table := range []string{"abilities", "channels", "models", "vendors"} {
		require.NoError(t, model.DB.Exec("DELETE FROM "+table).Error)
	}
	common.AutomaticDisableModelEnabled = false
	common.AutomaticEnableModelEnabled = false
	model.InvalidatePricingCache()
}

func createChannelWithModels(t *testing.T, id int, status int, modelsCSV string, abilityEnabled bool) {
	t.Helper()
	ch := &model.Channel{
		Id:     id,
		Type:   1,
		Key:    fmt.Sprintf("key-%d", id),
		Status: status,
		Name:   fmt.Sprintf("channel-%d", id),
		Models: modelsCSV,
		Group:  "default",
	}
	require.NoError(t, model.DB.Create(ch).Error)
	for _, name := range splitCSV(modelsCSV) {
		require.NoError(t, model.DB.Create(&model.Ability{
			Group:     "default",
			Model:     name,
			ChannelId: id,
			Enabled:   abilityEnabled && status == common.ChannelStatusEnabled,
		}).Error)
	}
}

func createMetaModel(t *testing.T, id int, name string, status int, nameRule int, autoDisabled bool) {
	t.Helper()
	m := &model.Model{
		Id:           id,
		ModelName:    name,
		NameRule:     nameRule,
		SyncOfficial: 1,
		// Status/AutoDisabledByRule may be zero values; force them after Create.
		Status: 1,
	}
	require.NoError(t, model.DB.Create(m).Error)
	require.NoError(t, model.DB.Model(&model.Model{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":                status,
		"auto_disabled_by_rule": autoDisabled,
	}).Error)
}

func splitCSV(s string) []string {
	parts := make([]string, 0)
	for _, p := range splitByComma(s) {
		if p != "" {
			parts = append(parts, p)
		}
	}
	return parts
}

func splitByComma(s string) []string {
	out := make([]string, 0)
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			part := s[start:i]
			// trim spaces
			for len(part) > 0 && (part[0] == ' ' || part[0] == '\t') {
				part = part[1:]
			}
			for len(part) > 0 && (part[len(part)-1] == ' ' || part[len(part)-1] == '\t') {
				part = part[:len(part)-1]
			}
			out = append(out, part)
			start = i + 1
		}
	}
	return out
}

func loadModel(t *testing.T, id int) model.Model {
	t.Helper()
	var m model.Model
	require.NoError(t, model.DB.First(&m, id).Error)
	return m
}

func TestSyncModelChannelAvailability_ExactMatchLastChannelFails(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true

	createChannelWithModels(t, 1, common.ChannelStatusEnabled, "gpt-4", true)
	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRuleExact, false)

	// still available
	res := SyncModelChannelAvailability("test")
	assert.Equal(t, 0, res.Disabled)
	assert.Equal(t, modelStatusEnabled, loadModel(t, 1).Status)

	// disable only channel
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("status", common.ChannelStatusManuallyDisabled).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 1).Update("enabled", false).Error)

	res = SyncModelChannelAvailability("last-channel-down")
	assert.Equal(t, 1, res.Disabled)
	m := loadModel(t, 1)
	assert.Equal(t, modelStatusDisabled, m.Status)
	assert.True(t, m.AutoDisabledByRule)
}

func TestSyncModelChannelAvailability_OtherChannelStillAvailable(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true

	createChannelWithModels(t, 1, common.ChannelStatusEnabled, "gpt-4", true)
	createChannelWithModels(t, 2, common.ChannelStatusEnabled, "gpt-4", true)
	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRuleExact, false)

	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("status", common.ChannelStatusAutoDisabled).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 1).Update("enabled", false).Error)

	res := SyncModelChannelAvailability("other-channel-ok")
	assert.Equal(t, 0, res.Disabled)
	assert.Equal(t, modelStatusEnabled, loadModel(t, 1).Status)
}

func TestSyncModelChannelAvailability_SoftDeletedChannelNotAvailable(t *testing.T) {
	// Project hard-deletes channels; treat deleted channel rows as unavailable by removing them.
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true

	createChannelWithModels(t, 1, common.ChannelStatusEnabled, "gpt-4", true)
	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRuleExact, false)

	require.NoError(t, model.DB.Where("id = ?", 1).Delete(&model.Channel{}).Error)
	require.NoError(t, model.DB.Where("channel_id = ?", 1).Delete(&model.Ability{}).Error)

	res := SyncModelChannelAvailability("channel-deleted")
	assert.Equal(t, 1, res.Disabled)
	assert.True(t, loadModel(t, 1).AutoDisabledByRule)
}

func TestSyncModelChannelAvailability_ManualDisableProtected(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true
	common.AutomaticEnableModelEnabled = true

	createChannelWithModels(t, 1, common.ChannelStatusEnabled, "gpt-4", true)
	// already disabled manually (no auto marker)
	createMetaModel(t, 1, "gpt-4", modelStatusDisabled, model.NameRuleExact, false)

	// no channel available
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("status", common.ChannelStatusManuallyDisabled).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 1).Update("enabled", false).Error)

	res := SyncModelChannelAvailability("manual-disabled")
	assert.Equal(t, 0, res.Disabled)
	assert.Equal(t, 0, res.Enabled)
	m := loadModel(t, 1)
	assert.Equal(t, modelStatusDisabled, m.Status)
	assert.False(t, m.AutoDisabledByRule)

	// restore channel; still should not auto-enable manual disable
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("status", common.ChannelStatusEnabled).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 1).Update("enabled", true).Error)
	res = SyncModelChannelAvailability("channel-recovered")
	assert.Equal(t, 0, res.Enabled)
	assert.Equal(t, modelStatusDisabled, loadModel(t, 1).Status)
}

func TestSyncModelChannelAvailability_RecoverOnlyWhenEnableSwitchOn(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true
	common.AutomaticEnableModelEnabled = false

	createChannelWithModels(t, 1, common.ChannelStatusEnabled, "gpt-4", true)
	createMetaModel(t, 1, "gpt-4", modelStatusDisabled, model.NameRuleExact, true)

	res := SyncModelChannelAvailability("enable-off")
	assert.Equal(t, 0, res.Enabled)
	assert.Equal(t, modelStatusDisabled, loadModel(t, 1).Status)
	assert.True(t, loadModel(t, 1).AutoDisabledByRule)

	common.AutomaticEnableModelEnabled = true
	res = SyncModelChannelAvailability("enable-on")
	assert.Equal(t, 1, res.Enabled)
	m := loadModel(t, 1)
	assert.Equal(t, modelStatusEnabled, m.Status)
	assert.True(t, m.AutoDisabledByRule)
}

func TestSyncModelChannelAvailability_RulePrefixMatch(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true

	createChannelWithModels(t, 1, common.ChannelStatusEnabled, "gpt-4-turbo", true)
	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRulePrefix, false)

	res := SyncModelChannelAvailability("prefix-ok")
	assert.Equal(t, 0, res.Disabled)

	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("status", common.ChannelStatusAutoDisabled).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 1).Update("enabled", false).Error)
	res = SyncModelChannelAvailability("prefix-down")
	assert.Equal(t, 1, res.Disabled)
}

func TestSyncModelChannelAvailability_RuleContainsAndSuffix(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true

	createChannelWithModels(t, 1, common.ChannelStatusEnabled, "claude-3-opus", true)
	createMetaModel(t, 1, "opus", modelStatusEnabled, model.NameRuleContains, false)
	createMetaModel(t, 2, "-opus", modelStatusEnabled, model.NameRuleSuffix, false)

	res := SyncModelChannelAvailability("rules-ok")
	assert.Equal(t, 0, res.Disabled)

	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("status", common.ChannelStatusManuallyDisabled).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 1).Update("enabled", false).Error)
	res = SyncModelChannelAvailability("rules-down")
	assert.Equal(t, 2, res.Disabled)
}

func TestSyncModelChannelAvailability_MainSwitchOffKeepsMarker(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = false
	common.AutomaticEnableModelEnabled = false

	createMetaModel(t, 1, "gpt-4", modelStatusDisabled, model.NameRuleExact, true)
	res := SyncModelChannelAvailability("both-off")
	assert.True(t, res.Skipped)
	m := loadModel(t, 1)
	assert.Equal(t, modelStatusDisabled, m.Status)
	assert.True(t, m.AutoDisabledByRule)
}

func TestSyncModelChannelAvailability_IdempotentDisable(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true

	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRuleExact, false)
	res1 := SyncModelChannelAvailability("first")
	assert.Equal(t, 1, res1.Disabled)
	res2 := SyncModelChannelAvailability("second")
	assert.Equal(t, 0, res2.Disabled)
	assert.True(t, loadModel(t, 1).AutoDisabledByRule)
}

func TestClearModelAutoDisabledByRule(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	createMetaModel(t, 1, "gpt-4", modelStatusDisabled, model.NameRuleExact, true)
	ClearModelAutoDisabledByRule(1)
	assert.False(t, loadModel(t, 1).AutoDisabledByRule)
}

func TestMaybeSyncModelChannelAvailabilityAfterOptionChange(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true
	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRuleExact, false)

	MaybeSyncModelChannelAvailabilityAfterOptionChange("AutomaticDisableModelEnabled", "false")
	assert.Equal(t, modelStatusEnabled, loadModel(t, 1).Status)

	MaybeSyncModelChannelAvailabilityAfterOptionChange("AutomaticDisableModelEnabled", "true")
	assert.Equal(t, modelStatusDisabled, loadModel(t, 1).Status)
	assert.True(t, loadModel(t, 1).AutoDisabledByRule)
}

func TestSyncModelChannelAvailability_AbilityDisabledChannelEnabledNotAvailable(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true

	createChannelWithModels(t, 1, common.ChannelStatusEnabled, "gpt-4", false)
	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRuleExact, false)

	res := SyncModelChannelAvailability("ability-disabled")
	assert.Equal(t, 1, res.Disabled)
}

func TestSyncModelChannelAvailability_ChannelLifecycleIntegration(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true
	common.AutomaticEnableModelEnabled = true

	// create channel + model (channel.create)
	createChannelWithModels(t, 1, common.ChannelStatusEnabled, "gpt-4,gpt-4-turbo", true)
	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRuleExact, false)
	createMetaModel(t, 2, "gpt-4-", modelStatusEnabled, model.NameRulePrefix, false)

	res := SyncModelChannelAvailability("channel.create")
	assert.Equal(t, 0, res.Disabled)

	// edit models list removes exact model binding (channel.update models)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("models", "gpt-4-turbo").Error)
	require.NoError(t, model.DB.Where("channel_id = ? AND model = ?", 1, "gpt-4").Delete(&model.Ability{}).Error)
	res = SyncModelChannelAvailability("channel.update")
	assert.Equal(t, 1, res.Disabled)
	assert.True(t, loadModel(t, 1).AutoDisabledByRule)
	assert.Equal(t, modelStatusEnabled, loadModel(t, 2).Status) // prefix still matches gpt-4-turbo

	// status disable channel (channel.status_update / tag / batch)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("status", common.ChannelStatusManuallyDisabled).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 1).Update("enabled", false).Error)
	res = SyncModelChannelAvailability("channel.status_update")
	assert.Equal(t, 1, res.Disabled) // prefix model now also disabled
	assert.True(t, loadModel(t, 2).AutoDisabledByRule)

	// system auto enable channel recovery
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("status", common.ChannelStatusEnabled).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 1).Update("enabled", true).Error)
	res = SyncModelChannelAvailability("channel.auto_enable")
	assert.Equal(t, 1, res.Enabled) // only models with available exact names recover (prefix)
	assert.Equal(t, modelStatusEnabled, loadModel(t, 2).Status)
	assert.Equal(t, modelStatusDisabled, loadModel(t, 1).Status) // gpt-4 still no exact ability

	// re-add ability for gpt-4 via recreate ability then recover
	require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: "gpt-4", ChannelId: 1, Enabled: true}).Error)
	res = SyncModelChannelAvailability("channel.update")
	assert.Equal(t, 1, res.Enabled)
	assert.Equal(t, modelStatusEnabled, loadModel(t, 1).Status)

	// delete channel
	require.NoError(t, model.DB.Where("id = ?", 1).Delete(&model.Channel{}).Error)
	require.NoError(t, model.DB.Where("channel_id = ?", 1).Delete(&model.Ability{}).Error)
	res = SyncModelChannelAvailability("channel.delete")
	assert.Equal(t, 2, res.Disabled)
}

func TestSyncModelChannelAvailability_FullCalibrationOnSwitch(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	// models without channels stay enabled until switch opens
	createMetaModel(t, 1, "lonely-model", modelStatusEnabled, model.NameRuleExact, false)
	createMetaModel(t, 2, "already-off", modelStatusDisabled, model.NameRuleExact, false)

	common.AutomaticDisableModelEnabled = false
	res := SyncModelChannelAvailability("before")
	assert.True(t, res.Skipped)

	common.AutomaticDisableModelEnabled = true
	MaybeSyncModelChannelAvailabilityAfterOptionChange("AutomaticDisableModelEnabled", "true")
	m1 := loadModel(t, 1)
	assert.Equal(t, modelStatusDisabled, m1.Status)
	assert.True(t, m1.AutoDisabledByRule)
	// already disabled without marker remains manual
	m2 := loadModel(t, 2)
	assert.Equal(t, modelStatusDisabled, m2.Status)
	assert.False(t, m2.AutoDisabledByRule)
}
