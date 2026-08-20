package service

import (
	"fmt"
	"sort"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// configureVisibleGroupsTest 只设置用户可用分组；GroupSpecialUsableGroup 保持
// 其默认空值（无需改动），因此不涉及特殊分组增删。
func configureVisibleGroupsTest(t *testing.T) {
	t.Helper()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
	})
}

func TestGetUserVisibleGroupsRootIsUnrestricted(t *testing.T) {
	configureVisibleGroupsTest(t)
	groups, unrestricted := GetUserVisibleGroups(common.RoleRootUser, "default")
	assert.True(t, unrestricted)
	assert.Nil(t, groups)
}

func TestGetUserVisibleGroupsGuestIsUnrestricted(t *testing.T) {
	configureVisibleGroupsTest(t)
	groups, unrestricted := GetUserVisibleGroups(common.RoleGuestUser, "")
	assert.True(t, unrestricted)
	assert.Nil(t, groups)
}

func TestGetUserVisibleGroupsAdminIsScopedToUsableGroups(t *testing.T) {
	configureVisibleGroupsTest(t)
	groups, unrestricted := GetUserVisibleGroups(common.RoleAdminUser, "default")
	assert.False(t, unrestricted)
	sort.Strings(groups)
	assert.Equal(t, []string{"default", "vip"}, groups)
}

func TestGetUserVisibleGroupsAlwaysContainsOwnGroup(t *testing.T) {
	configureVisibleGroupsTest(t)
	groups, unrestricted := GetUserVisibleGroups(common.RoleCommonUser, "standalone")
	assert.False(t, unrestricted)
	assert.Contains(t, groups, "standalone")
	require.NotEmpty(t, groups)
	_ = fmt.Sprint(groups)
}
