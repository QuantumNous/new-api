package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/require"
)

func withAutoOptGroupSettings(t *testing.T) {
	t.Helper()

	oldUsableGroups := setting.UserUsableGroups2JSONString()
	oldGroupRatio := ratio_setting.GroupRatio2JSONString()
	oldGroupGroupRatio := ratio_setting.GroupGroupRatio2JSONString()
	oldSpecialUsable := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.MarshalJSONString()

	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(oldUsableGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(oldGroupRatio))
		require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(oldGroupGroupRatio))
		require.NoError(t, ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.UnmarshalJSON([]byte(oldSpecialUsable)))
	})
}

func TestGetUserAutoOptGroupsSortsAllowedGroupsByEffectiveRatio(t *testing.T) {
	withAutoOptGroupSettings(t)

	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP","cheap":"Cheap","auto":"Auto","AutoOpt":"AutoOpt"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":0.8,"cheap":0.5}`))
	require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(`{"vip":{"default":0.3}}`))

	groups := GetUserAutoOptGroups("vip")

	require.Equal(t, []string{"default", "cheap", "vip"}, groups)
}

func TestGetUserAutoOptGroupsSupportsSpecialUsableGroupPermission(t *testing.T) {
	withAutoOptGroupSettings(t)

	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","auto":"Auto"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"hidden":0.01}`))
	require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(`{"default":{"vip":0.5}}`))
	require.NoError(t, ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.UnmarshalJSON([]byte(`{"default":{"+:AutoOpt":"AutoOpt","+:vip":"VIP","+:unpriced":"Unpriced","-:default":"removed"}}`)))

	groups := GetUserAutoOptGroups("default")
	pricedGroups := GetUserPricedUsableGroups("default")

	require.Equal(t, []string{"vip", "default"}, groups)
	require.Equal(t, map[string]string{"default": "用户分组", "vip": "VIP"}, pricedGroups)
	require.True(t, HasUserGroupRatio("default", "vip"))
	require.False(t, HasUserGroupRatio("default", "unpriced"))
}

func TestGetUserAutoOptGroupsRequiresAutoOptPermission(t *testing.T) {
	withAutoOptGroupSettings(t)

	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP","auto":"Auto"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":0.5}`))
	require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(`{}`))
	require.NoError(t, ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.UnmarshalJSON([]byte(`{}`)))

	require.False(t, UserCanUseAutoOptGroup("default"))
	require.Empty(t, GetUserAutoOptGroups("default"))
}
