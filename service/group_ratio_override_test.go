package service

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeGroupRatioOverrides(t *testing.T) {
	overrides := NormalizeGroupRatioOverrides(map[string]float64{
		" vip ": 0.75,
		"":      1,
		"bad":   -1,
	})

	require.Equal(t, map[string]float64{"vip": 0.75}, overrides)
}

func TestValidateGroupRatioOverridesRequiresExistingGroups(t *testing.T) {
	originalRatios := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	})
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"vip":1}`))

	assert.True(t, ValidateGroupRatioOverrides(map[string]float64{"vip": 0.5}))
	assert.True(t, ValidateGroupRatioOverrides(map[string]float64{}))
	assert.False(t, ValidateGroupRatioOverrides(map[string]float64{"missing": 0.5}))
	assert.False(t, ValidateGroupRatioOverrides(map[string]float64{"vip": -1}))
}

func TestUserGroupRatioOverride(t *testing.T) {
	setting := dto.UserSetting{GroupRatioOverrides: map[string]float64{"vip": 0.5}}

	ratio, ok := UserGroupRatioOverride(setting, " vip ")
	require.True(t, ok)
	assert.Equal(t, 0.5, ratio)

	_, ok = UserGroupRatioOverride(setting, "default")
	assert.False(t, ok)
}

func TestGetUserGroupRatioWithSettingUsesUserOverrideFirst(t *testing.T) {
	originalRatios := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	})
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"vip":2}`))

	setting := dto.UserSetting{GroupRatioOverrides: map[string]float64{"vip": 0.5}}

	assert.Equal(t, 0.5, GetUserGroupRatioWithSetting("default", "vip", setting))
	assert.Equal(t, 2.0, GetUserGroupRatioWithSetting("default", "vip", dto.UserSetting{}))
}
