package service

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetUserUsableGroupsWithSettingPreservesLegacyBehaviorWhenUnset(t *testing.T) {
	legacy := GetUserUsableGroups("default")
	withEmptySetting := GetUserUsableGroupsWithSetting("default", dto.UserSetting{})

	assert.Equal(t, legacy, withEmptySetting)
}

func TestGetUserUsableGroupsWithSettingUsesSelectableAndAssignedUnion(t *testing.T) {
	originalGroups := setting.UserUsableGroups2JSONString()
	originalRatios := ratio_setting.GroupRatio2JSONString()
	defer func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	}()

	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"public":"Public"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"public":1,"hidden":2}`))

	groups := GetUserUsableGroupsWithSetting("default", dto.UserSetting{
		AllowedModelGroups: []string{" hidden ", "missing"},
	})
	assert.Contains(t, groups, "public")
	assert.Contains(t, groups, "hidden")
	assert.NotContains(t, groups, "missing")
}

func TestGetUserAssignedModelGroupsWithSettingOnlyUsesExplicitValidGroups(t *testing.T) {
	originalGroups := setting.UserUsableGroups2JSONString()
	originalRatios := ratio_setting.GroupRatio2JSONString()
	defer func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	}()

	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"public":"Public"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"public":1,"hidden":2}`))

	groups := GetUserAssignedModelGroupsWithSetting(dto.UserSetting{
		AllowedModelGroups: []string{" hidden ", "missing"},
	})
	assert.Contains(t, groups, "hidden")
	assert.NotContains(t, groups, "public")
	assert.NotContains(t, groups, "missing")
}

func TestGetUserUsableGroupsWithSettingEmptyAllowlistPreservesLegacyGroups(t *testing.T) {
	originalGroups := setting.UserUsableGroups2JSONString()
	originalRatios := ratio_setting.GroupRatio2JSONString()
	defer func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	}()

	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"public":"Public"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"public":1,"legacy":2}`))

	legacy := GetUserUsableGroupsWithSetting("legacy", dto.UserSetting{})
	assert.Contains(t, legacy, "legacy")
	assert.Contains(t, legacy, "public")
}
