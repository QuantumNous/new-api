package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func restoreRateLimitGroup(t *testing.T) {
	t.Helper()
	ModelRequestRateLimitMutex.RLock()
	orig := ModelRequestRateLimitGroup
	ModelRequestRateLimitMutex.RUnlock()
	t.Cleanup(func() {
		ModelRequestRateLimitMutex.Lock()
		ModelRequestRateLimitGroup = orig
		ModelRequestRateLimitMutex.Unlock()
	})
}

// 解析失败必须原样保留正在生效的配置。
//
// 原先的写法是先把全局 map 清空再反序列化，非法 JSON 会让限流配置整体失效且不再恢复——
// 而周期同步路径不经过 CheckModelRequestRateLimitGroup，数据库里的非法值可以直接走到这里。
func TestUpdateRateLimitGroupKeepsPreviousConfigOnParseError(t *testing.T) {
	restoreRateLimitGroup(t)

	require.NoError(t, UpdateModelRequestRateLimitGroupByJSONString(`{"default":[100,50],"vip":[200,100]}`))

	require.Error(t, UpdateModelRequestRateLimitGroupByJSONString(`not json`))

	total, success, found := GetGroupRateLimit("default")
	assert.True(t, found, "解析失败不应清空已生效的限流配置")
	assert.Equal(t, 100, total)
	assert.Equal(t, 50, success)

	_, _, found = GetGroupRateLimit("vip")
	assert.True(t, found)
}

// 成功的更新必须整体替换，被移除的分组不能残留。
func TestUpdateRateLimitGroupReplacesRemovedGroups(t *testing.T) {
	restoreRateLimitGroup(t)

	require.NoError(t, UpdateModelRequestRateLimitGroupByJSONString(`{"default":[100,50],"vip":[200,100]}`))
	_, _, found := GetGroupRateLimit("vip")
	require.True(t, found)

	require.NoError(t, UpdateModelRequestRateLimitGroupByJSONString(`{"default":[300,150]}`))

	total, success, found := GetGroupRateLimit("default")
	assert.True(t, found)
	assert.Equal(t, 300, total)
	assert.Equal(t, 150, success)

	_, _, found = GetGroupRateLimit("vip")
	assert.False(t, found, "被移除的分组应查不到")
}

func TestGetGroupRateLimitReportsMissingGroup(t *testing.T) {
	restoreRateLimitGroup(t)

	require.NoError(t, UpdateModelRequestRateLimitGroupByJSONString(`{"default":[100,50]}`))

	total, success, found := GetGroupRateLimit("nonexistent")
	assert.False(t, found)
	assert.Zero(t, total)
	assert.Zero(t, success)
}

// 序列化形式必须保持不变，否则升级后数据库中已有的行会读不出来。
func TestRateLimitGroupSerializationRoundTrip(t *testing.T) {
	restoreRateLimitGroup(t)

	require.NoError(t, UpdateModelRequestRateLimitGroupByJSONString(`{"default":[100,50]}`))

	assert.JSONEq(t, `{"default":[100,50]}`, ModelRequestRateLimitGroup2JSONString())
}
