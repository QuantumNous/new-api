package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func restoreUserUsableGroups(t *testing.T) {
	t.Helper()
	orig := GetUserUsableGroupsCopy()
	t.Cleanup(func() {
		userUsableGroupsMutex.Lock()
		userUsableGroups = orig
		userUsableGroupsMutex.Unlock()
	})
}

// 与限流分组同源的缺陷：该函数的锁本身是正确的，但同样先清空再反序列化，
// 非法 JSON 会让可用分组配置整体失效且不再恢复。触发路径同为周期同步
// （model/option.go:561），且该路径不经过任何保存前校验。
func TestUpdateUserUsableGroupsKeepsPreviousConfigOnParseError(t *testing.T) {
	restoreUserUsableGroups(t)

	require.NoError(t, UpdateUserUsableGroupsByJSONString(`{"default":"默认分组","vip":"vip分组"}`))

	require.Error(t, UpdateUserUsableGroupsByJSONString(`not json`))

	groups := GetUserUsableGroupsCopy()
	assert.Len(t, groups, 2, "解析失败不应清空已生效的分组配置")
	assert.Equal(t, "默认分组", groups["default"])
	assert.Equal(t, "vip分组", GetUsableGroupDescription("vip"))
}

func TestUpdateUserUsableGroupsReplacesRemovedGroups(t *testing.T) {
	restoreUserUsableGroups(t)

	require.NoError(t, UpdateUserUsableGroupsByJSONString(`{"default":"默认分组","vip":"vip分组"}`))
	require.Len(t, GetUserUsableGroupsCopy(), 2)

	require.NoError(t, UpdateUserUsableGroupsByJSONString(`{"default":"默认分组"}`))

	groups := GetUserUsableGroupsCopy()
	assert.Len(t, groups, 1)
	assert.NotContains(t, groups, "vip", "被移除的分组应查不到")
	// 未配置的分组回落为分组名本身
	assert.Equal(t, "vip", GetUsableGroupDescription("vip"))
}

// 序列化形式必须保持不变，否则升级后数据库中已有的行会读不出来。
func TestUserUsableGroupsSerializationRoundTrip(t *testing.T) {
	restoreUserUsableGroups(t)

	require.NoError(t, UpdateUserUsableGroupsByJSONString(`{"default":"默认分组"}`))

	assert.JSONEq(t, `{"default":"默认分组"}`, UserUsableGroups2JSONString())
}
