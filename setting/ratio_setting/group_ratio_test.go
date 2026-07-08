package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func restoreGroupRatioSettings(t *testing.T) {
	t.Helper()

	originalGroupRatio := GroupRatio2JSONString()
	originalGroupGroupRatio := GroupGroupRatio2JSONString()
	originalGroupModelRatio := GroupModelRatio2JSONString()

	t.Cleanup(func() {
		require.NoError(t, UpdateGroupRatioByJSONString(originalGroupRatio))
		require.NoError(t, UpdateGroupGroupRatioByJSONString(originalGroupGroupRatio))
		require.NoError(t, UpdateGroupModelRatioByJSONString(originalGroupModelRatio))
	})
}

func TestGetEffectiveGroupRatioPrecedence(t *testing.T) {
	restoreGroupRatioSettings(t)

	require.NoError(t, UpdateGroupRatioByJSONString(`{"plg":0.9}`))
	require.NoError(t, UpdateGroupGroupRatioByJSONString(`{"vip":{"plg":0.8}}`))
	require.NoError(t, UpdateGroupModelRatioByJSONString(`{"plg":{"gpt-5.5":0.3}}`))

	groupModel := GetEffectiveGroupRatio("vip", "plg", "gpt-5.5")
	require.Equal(t, 0.3, groupModel.GroupRatio)
	require.True(t, groupModel.HasGroupModelRatio)
	require.Equal(t, 0.3, groupModel.GroupModelRatio)
	require.Equal(t, "plg", groupModel.GroupModelRatioGroup)
	require.Equal(t, "gpt-5.5", groupModel.GroupModelRatioModel)
	require.False(t, groupModel.HasSpecialRatio)

	userGroup := GetEffectiveGroupRatio("vip", "plg", "gpt-4o-mini")
	require.Equal(t, 0.8, userGroup.GroupRatio)
	require.True(t, userGroup.HasSpecialRatio)
	require.Equal(t, 0.8, userGroup.GroupSpecialRatio)
	require.False(t, userGroup.HasGroupModelRatio)

	normalGroup := GetEffectiveGroupRatio("default", "plg", "gpt-4o-mini")
	require.Equal(t, 0.9, normalGroup.GroupRatio)
	require.False(t, normalGroup.HasSpecialRatio)
	require.False(t, normalGroup.HasGroupModelRatio)

	missingGroup := GetEffectiveGroupRatio("default", "missing", "gpt-4o-mini")
	require.Equal(t, 1.0, missingGroup.GroupRatio)
	require.False(t, missingGroup.HasSpecialRatio)
	require.False(t, missingGroup.HasGroupModelRatio)
}

func TestCheckGroupModelRatioRejectsNegativeRatio(t *testing.T) {
	require.Error(t, CheckGroupModelRatio(`{"plg":{"gpt-5.5":-0.1}}`))
	require.NoError(t, CheckGroupModelRatio(`{"plg":{"gpt-5.5":0}}`))
}
