package operation_setting

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateChannelContributionOptionRestrictsChannelTypesToSupportedSubset(t *testing.T) {
	assert.NoError(t, ValidateChannelContributionOption(
		ChannelContributionSettingPrefix+"allowed_channel_types",
		`[1,14,60]`,
	))
	assert.Error(t, ValidateChannelContributionOption(
		ChannelContributionSettingPrefix+"allowed_channel_types",
		`[3]`,
	))
	assert.Error(t, ValidateChannelContributionOption(
		ChannelContributionSettingPrefix+"allowed_channel_types",
		`[1,1]`,
	))
	assert.Error(t, ValidateChannelContributionOption(
		ChannelContributionSettingPrefix+"allowed_channel_types",
		`["1"]`,
	))
}

func TestValidateChannelContributionOptionRejectsInvalidGroupsAndDurations(t *testing.T) {
	assert.NoError(t, ValidateChannelContributionOption(
		ChannelContributionSettingPrefix+"allowed_groups",
		`["default","vip"]`,
	))
	assert.Error(t, ValidateChannelContributionOption(
		ChannelContributionSettingPrefix+"allowed_groups",
		`["default"," default "]`,
	))
	assert.Error(t, ValidateChannelContributionOption(
		ChannelContributionSettingPrefix+"allowed_groups",
		`[""]`,
	))
	assert.NoError(t, ValidateChannelContributionOption(
		ChannelContributionSettingPrefix+"unavailable_delete_hours",
		"48",
	))
	assert.Error(t, ValidateChannelContributionOption(
		ChannelContributionSettingPrefix+"unavailable_delete_hours",
		"0",
	))
	assert.Error(t, ValidateChannelContributionOption(
		ChannelContributionSettingPrefix+"unavailable_delete_hours",
		"48 hours",
	))
}

func TestGetChannelContributionSettingReturnsDeepCopy(t *testing.T) {
	previous := make(map[string]string)
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		if strings.HasPrefix(key, ChannelContributionSettingPrefix) {
			previous[key] = value
		}
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(previous))
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		ChannelContributionSettingPrefix + "allowed_groups":        `["fixture"]`,
		ChannelContributionSettingPrefix + "allowed_channel_types": `[1]`,
	}))

	first := GetChannelContributionSetting()
	require.NotEmpty(t, first.AllowedGroups)
	require.NotEmpty(t, first.AllowedChannelTypes)
	first.AllowedGroups[0] = "mutated"
	first.AllowedChannelTypes[0] = -1

	second := GetChannelContributionSetting()
	assert.NotEqual(t, "mutated", second.AllowedGroups[0])
	assert.NotEqual(t, -1, second.AllowedChannelTypes[0])
}
