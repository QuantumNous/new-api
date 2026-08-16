package service

import (
	"errors"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func resetModelChannelAvailabilityFixtures(t *testing.T) {
	t.Helper()
	for _, table := range []string{"abilities", "channels", "models", "vendors", "options"} {
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

func requireModelChannelAvailabilitySync(t *testing.T, reason string) ModelChannelAvailabilityResult {
	t.Helper()
	result, err := SyncModelChannelAvailability(reason)
	require.NoError(t, err)
	return result
}

func TestSyncModelChannelAvailability_ExactMatchLastChannelFails(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true

	createChannelWithModels(t, 1, common.ChannelStatusEnabled, "gpt-4", true)
	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRuleExact, false)

	// still available
	res := requireModelChannelAvailabilitySync(t, "test")
	assert.Equal(t, 0, res.Disabled)
	assert.Equal(t, modelStatusEnabled, loadModel(t, 1).Status)

	// disable only channel
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("status", common.ChannelStatusManuallyDisabled).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 1).Update("enabled", false).Error)

	res = requireModelChannelAvailabilitySync(t, "last-channel-down")
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

	res := requireModelChannelAvailabilitySync(t, "other-channel-ok")
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

	res := requireModelChannelAvailabilitySync(t, "channel-deleted")
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

	res := requireModelChannelAvailabilitySync(t, "manual-disabled")
	assert.Equal(t, 0, res.Disabled)
	assert.Equal(t, 0, res.Enabled)
	m := loadModel(t, 1)
	assert.Equal(t, modelStatusDisabled, m.Status)
	assert.False(t, m.AutoDisabledByRule)

	// restore channel; still should not auto-enable manual disable
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("status", common.ChannelStatusEnabled).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 1).Update("enabled", true).Error)
	res = requireModelChannelAvailabilitySync(t, "channel-recovered")
	assert.Equal(t, 0, res.Enabled)
	assert.Equal(t, modelStatusDisabled, loadModel(t, 1).Status)
}

func TestSyncModelChannelAvailability_RecoverOnlyWhenEnableSwitchOn(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true
	common.AutomaticEnableModelEnabled = false

	createChannelWithModels(t, 1, common.ChannelStatusEnabled, "gpt-4", true)
	createMetaModel(t, 1, "gpt-4", modelStatusDisabled, model.NameRuleExact, true)

	res := requireModelChannelAvailabilitySync(t, "enable-off")
	assert.Equal(t, 0, res.Enabled)
	assert.Equal(t, modelStatusDisabled, loadModel(t, 1).Status)
	assert.True(t, loadModel(t, 1).AutoDisabledByRule)

	common.AutomaticEnableModelEnabled = true
	res = requireModelChannelAvailabilitySync(t, "enable-on")
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

	res := requireModelChannelAvailabilitySync(t, "prefix-ok")
	assert.Equal(t, 0, res.Disabled)

	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("status", common.ChannelStatusAutoDisabled).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 1).Update("enabled", false).Error)
	res = requireModelChannelAvailabilitySync(t, "prefix-down")
	assert.Equal(t, 1, res.Disabled)
}

func TestSyncModelChannelAvailability_RuleContainsAndSuffix(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true

	createChannelWithModels(t, 1, common.ChannelStatusEnabled, "claude-3-opus", true)
	createMetaModel(t, 1, "opus", modelStatusEnabled, model.NameRuleContains, false)
	createMetaModel(t, 2, "-opus", modelStatusEnabled, model.NameRuleSuffix, false)

	res := requireModelChannelAvailabilitySync(t, "rules-ok")
	assert.Equal(t, 0, res.Disabled)

	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("status", common.ChannelStatusManuallyDisabled).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 1).Update("enabled", false).Error)
	res = requireModelChannelAvailabilitySync(t, "rules-down")
	assert.Equal(t, 2, res.Disabled)
}

func TestSyncModelChannelAvailability_MainSwitchOffKeepsMarker(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = false
	common.AutomaticEnableModelEnabled = false

	createMetaModel(t, 1, "gpt-4", modelStatusDisabled, model.NameRuleExact, true)
	res := requireModelChannelAvailabilitySync(t, "both-off")
	assert.True(t, res.Skipped)
	m := loadModel(t, 1)
	assert.Equal(t, modelStatusDisabled, m.Status)
	assert.True(t, m.AutoDisabledByRule)
}

func TestSyncModelChannelAvailability_IdempotentDisable(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true

	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRuleExact, false)
	res1 := requireModelChannelAvailabilitySync(t, "first")
	assert.Equal(t, 1, res1.Disabled)
	res2 := requireModelChannelAvailabilitySync(t, "second")
	assert.Equal(t, 0, res2.Disabled)
	assert.True(t, loadModel(t, 1).AutoDisabledByRule)
}

func TestModelUpdateClearsAutoDisabledMarkerWithStatusChange(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	createMetaModel(t, 1, "gpt-4", modelStatusDisabled, model.NameRuleExact, true)

	updated := loadModel(t, 1)
	updated.Status = modelStatusEnabled
	require.NoError(t, updated.Update())

	persisted := loadModel(t, 1)
	assert.Equal(t, modelStatusEnabled, persisted.Status)
	assert.False(t, persisted.AutoDisabledByRule)
}

func TestMaybeSyncModelChannelAvailabilityAfterOptionChange(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true
	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRuleExact, false)

	require.NoError(t, MaybeSyncModelChannelAvailabilityAfterOptionChange("AutomaticDisableModelEnabled", "false"))
	assert.Equal(t, modelStatusEnabled, loadModel(t, 1).Status)

	require.NoError(t, MaybeSyncModelChannelAvailabilityAfterOptionChange("AutomaticDisableModelEnabled", "true"))
	assert.Equal(t, modelStatusDisabled, loadModel(t, 1).Status)
	assert.True(t, loadModel(t, 1).AutoDisabledByRule)
}

func TestSyncModelChannelAvailability_AbilityDisabledChannelEnabledNotAvailable(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true

	createChannelWithModels(t, 1, common.ChannelStatusEnabled, "gpt-4", false)
	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRuleExact, false)

	res := requireModelChannelAvailabilitySync(t, "ability-disabled")
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

	res := requireModelChannelAvailabilitySync(t, "channel.create")
	assert.Equal(t, 0, res.Disabled)

	// edit models list removes exact model binding (channel.update models)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("models", "gpt-4-turbo").Error)
	require.NoError(t, model.DB.Where("channel_id = ? AND model = ?", 1, "gpt-4").Delete(&model.Ability{}).Error)
	res = requireModelChannelAvailabilitySync(t, "channel.update")
	assert.Equal(t, 1, res.Disabled)
	assert.True(t, loadModel(t, 1).AutoDisabledByRule)
	assert.Equal(t, modelStatusEnabled, loadModel(t, 2).Status) // prefix still matches gpt-4-turbo

	// status disable channel (channel.status_update / tag / batch)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("status", common.ChannelStatusManuallyDisabled).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 1).Update("enabled", false).Error)
	res = requireModelChannelAvailabilitySync(t, "channel.status_update")
	assert.Equal(t, 1, res.Disabled) // prefix model now also disabled
	assert.True(t, loadModel(t, 2).AutoDisabledByRule)

	// system auto enable channel recovery
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 1).Update("status", common.ChannelStatusEnabled).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 1).Update("enabled", true).Error)
	res = requireModelChannelAvailabilitySync(t, "channel.auto_enable")
	assert.Equal(t, 1, res.Enabled) // only models with available exact names recover (prefix)
	assert.Equal(t, modelStatusEnabled, loadModel(t, 2).Status)
	assert.Equal(t, modelStatusDisabled, loadModel(t, 1).Status) // gpt-4 still no exact ability

	// re-add ability for gpt-4 via recreate ability then recover
	require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: "gpt-4", ChannelId: 1, Enabled: true}).Error)
	res = requireModelChannelAvailabilitySync(t, "channel.update")
	assert.Equal(t, 1, res.Enabled)
	assert.Equal(t, modelStatusEnabled, loadModel(t, 1).Status)

	// delete channel
	require.NoError(t, model.DB.Where("id = ?", 1).Delete(&model.Channel{}).Error)
	require.NoError(t, model.DB.Where("channel_id = ?", 1).Delete(&model.Ability{}).Error)
	res = requireModelChannelAvailabilitySync(t, "channel.delete")
	assert.Equal(t, 2, res.Disabled)
}

func TestSyncModelChannelAvailability_FullCalibrationOnSwitch(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	// models without channels stay enabled until switch opens
	createMetaModel(t, 1, "lonely-model", modelStatusEnabled, model.NameRuleExact, false)
	createMetaModel(t, 2, "already-off", modelStatusDisabled, model.NameRuleExact, false)

	common.AutomaticDisableModelEnabled = false
	res := requireModelChannelAvailabilitySync(t, "before")
	assert.True(t, res.Skipped)

	common.AutomaticDisableModelEnabled = true
	require.NoError(t, MaybeSyncModelChannelAvailabilityAfterOptionChange("AutomaticDisableModelEnabled", "true"))
	m1 := loadModel(t, 1)
	assert.Equal(t, modelStatusDisabled, m1.Status)
	assert.True(t, m1.AutoDisabledByRule)
	// already disabled without marker remains manual
	m2 := loadModel(t, 2)
	assert.Equal(t, modelStatusDisabled, m2.Status)
	assert.False(t, m2.AutoDisabledByRule)
}

func TestSyncModelChannelAvailability_EnableRequiresDisableSwitch(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	// enable alone must not recover models
	common.AutomaticDisableModelEnabled = false
	common.AutomaticEnableModelEnabled = true

	createChannelWithModels(t, 1, common.ChannelStatusEnabled, "gpt-4", true)
	createMetaModel(t, 1, "gpt-4", modelStatusDisabled, model.NameRuleExact, true)

	res := requireModelChannelAvailabilitySync(t, "enable-without-disable")
	assert.True(t, res.Skipped)
	assert.Equal(t, 0, res.Enabled)
	assert.Equal(t, modelStatusDisabled, loadModel(t, 1).Status)

	common.AutomaticDisableModelEnabled = true
	res = requireModelChannelAvailabilitySync(t, "enable-with-disable")
	assert.Equal(t, 1, res.Enabled)
	assert.Equal(t, modelStatusEnabled, loadModel(t, 1).Status)
}

func TestManualEnableModelsWithChannels_OnlyAutoDisabled(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	createChannelWithModels(t, 1, common.ChannelStatusEnabled, "gpt-4,claude-3", true)
	// auto-disabled with channels recovered
	createMetaModel(t, 1, "gpt-4", modelStatusDisabled, model.NameRuleExact, true)
	// manually disabled with channels available
	createMetaModel(t, 2, "claude-3", modelStatusDisabled, model.NameRuleExact, false)
	// enabled with no channel; the manual enable action must not disable it.
	createMetaModel(t, 3, "o3", modelStatusEnabled, model.NameRuleExact, false)

	res, err := ManualEnableModelsWithChannels()
	require.NoError(t, err)
	assert.Equal(t, 0, res.Disabled)
	assert.Equal(t, 1, res.Enabled)
	assert.Equal(t, modelStatusEnabled, loadModel(t, 1).Status)
	assert.True(t, loadModel(t, 1).AutoDisabledByRule)
	assert.Equal(t, modelStatusDisabled, loadModel(t, 2).Status)
	assert.False(t, loadModel(t, 2).AutoDisabledByRule)
	assert.Equal(t, modelStatusEnabled, loadModel(t, 3).Status)
}

func TestUpdateOptionPairsEnableOffWhenDisableOff(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	require.NoError(t, model.UpdateOptionsBulk(map[string]string{
		"AutomaticDisableModelEnabled": "1",
		"AutomaticEnableModelEnabled":  "1",
	}))
	assert.True(t, common.AutomaticDisableModelEnabled)
	assert.True(t, common.AutomaticEnableModelEnabled)

	require.NoError(t, model.UpdateOption("AutomaticDisableModelEnabled", "false"))
	assert.False(t, common.AutomaticDisableModelEnabled)
	assert.False(t, common.AutomaticEnableModelEnabled)
	var options []model.Option
	require.NoError(t, model.DB.Where("key IN ?", []string{
		"AutomaticDisableModelEnabled",
		"AutomaticEnableModelEnabled",
	}).Order("key").Find(&options).Error)
	require.Len(t, options, 2)
	assert.Equal(t, "false", options[0].Value)
	assert.Equal(t, "false", options[1].Value)
}

func TestUpdateOptionRejectsModelAutoEnableWithoutAutoDisable(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}

	require.NoError(t, model.UpdateOption("AutomaticEnableModelEnabled", "1"))

	assert.False(t, common.AutomaticDisableModelEnabled)
	assert.False(t, common.AutomaticEnableModelEnabled)
	var options []model.Option
	require.NoError(t, model.DB.Where("key IN ?", []string{
		"AutomaticDisableModelEnabled",
		"AutomaticEnableModelEnabled",
	}).Order("key").Find(&options).Error)
	require.Len(t, options, 2)
	assert.Equal(t, "false", options[0].Value)
	assert.Equal(t, "false", options[1].Value)
}

func TestInitOptionMapNormalizesStoredModelAvailabilityPair(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	require.NoError(t, model.DB.Create(&[]model.Option{
		{Key: "AutomaticDisableModelEnabled", Value: "false"},
		{Key: "AutomaticEnableModelEnabled", Value: "1"},
	}).Error)

	model.InitOptionMap()

	assert.False(t, common.AutomaticDisableModelEnabled)
	assert.False(t, common.AutomaticEnableModelEnabled)
	var options []model.Option
	require.NoError(t, model.DB.Where("key IN ?", []string{
		"AutomaticDisableModelEnabled",
		"AutomaticEnableModelEnabled",
	}).Order("key").Find(&options).Error)
	require.Len(t, options, 2)
	assert.Equal(t, "false", options[0].Value)
	assert.Equal(t, "false", options[1].Value)
}

func TestSyncModelChannelAvailability_MultiKeyRequiresEnabledKey(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true
	common.AutomaticEnableModelEnabled = true

	channel := &model.Channel{
		Id:     1,
		Type:   1,
		Key:    "key-a\nkey-b",
		Status: common.ChannelStatusEnabled,
		Name:   "multi-key-channel",
		Models: "gpt-4",
		Group:  "default",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:         true,
			MultiKeySize:       2,
			MultiKeyStatusList: map[int]int{0: 2, 1: 3},
		},
	}
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group: "default", Model: "gpt-4", ChannelId: channel.Id, Enabled: true,
	}).Error)
	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRuleExact, false)

	result := requireModelChannelAvailabilitySync(t, "all-keys-disabled")
	assert.Equal(t, 1, result.Disabled)
	assert.Equal(t, modelStatusDisabled, loadModel(t, 1).Status)

	delete(channel.ChannelInfo.MultiKeyStatusList, 0)
	require.NoError(t, channel.SaveChannelInfo())
	result = requireModelChannelAvailabilitySync(t, "key-reenabled")
	assert.Equal(t, 1, result.Enabled)
	assert.Equal(t, modelStatusEnabled, loadModel(t, 1).Status)
}

func TestSyncModelChannelAvailability_MultiKeyBlankEntriesAreUnavailable(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true

	channel := &model.Channel{
		Id:     1,
		Type:   1,
		Key:    "   \n\t",
		Status: common.ChannelStatusEnabled,
		Name:   "blank-multi-key-channel",
		Models: "gpt-4",
		Group:  "default",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 2,
		},
	}
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group: "default", Model: "gpt-4", ChannelId: channel.Id, Enabled: true,
	}).Error)
	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRuleExact, false)

	result := requireModelChannelAvailabilitySync(t, "blank-keys")
	assert.Equal(t, 1, result.Disabled)
	assert.Equal(t, modelStatusDisabled, loadModel(t, 1).Status)
}

func TestStartupCalibrationUsesPersistedOptions(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = false
	common.AutomaticEnableModelEnabled = false
	require.NoError(t, model.DB.Create(&[]model.Option{
		{Key: "AutomaticDisableModelEnabled", Value: "true"},
		{Key: "AutomaticEnableModelEnabled", Value: "false"},
	}).Error)
	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRuleExact, false)

	require.NoError(t, CalibrateModelChannelAvailabilityAtStartup())
	assert.Equal(t, modelStatusDisabled, loadModel(t, 1).Status)
}

func TestSyncModelChannelAvailability_ReturnsDatabaseError(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true

	forcedErr := errors.New("forced database failure")
	callbackName := "test:fail-model-availability-query"
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		tx.AddError(forcedErr)
	}))
	t.Cleanup(func() { _ = model.DB.Callback().Query().Remove(callbackName) })

	_, err := SyncModelChannelAvailability("database-error")
	require.Error(t, err)
	assert.ErrorIs(t, err, forcedErr)
}

func TestSyncModelChannelAvailabilityAfterMutationRetriesWithoutFailingCommittedOperation(t *testing.T) {
	resetModelChannelAvailabilityFixtures(t)
	common.AutomaticDisableModelEnabled = true
	createMetaModel(t, 1, "gpt-4", modelStatusEnabled, model.NameRuleExact, false)

	var modelQueries atomic.Int32
	forcedErr := errors.New("transient model query failure")
	callbackName := "test:fail-first-model-availability-query"
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "models" && modelQueries.Add(1) == 1 {
			tx.AddError(forcedErr)
		}
	}))
	t.Cleanup(func() { _ = model.DB.Callback().Query().Remove(callbackName) })

	result := SyncModelChannelAvailabilityAfterMutation("committed-model-create")
	assert.Zero(t, result.Disabled)
	assert.Equal(t, "gpt-4", loadModel(t, 1).ModelName)
	retryDone := make(chan struct{})
	go func() {
		modelChannelAvailabilityRetryPending.Wait()
		close(retryDone)
	}()
	select {
	case <-retryDone:
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for model availability retry")
	}
	assert.Equal(t, modelStatusDisabled, loadModel(t, 1).Status)
	assert.GreaterOrEqual(t, modelQueries.Load(), int32(2))
}
