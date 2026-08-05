package setting

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 敏感词、自动分组和客户端跳转配置原先都是"先清空再逐个填充"，读者可能读到空的或残缺的列表。
// 敏感词尤其要紧：它在中继请求路径上决定是否拦截内容，读到空列表意味着放行本应拦截的请求。
//
// 下面三组测试锁定同一个契约：已经取得的列表不会被后续热更新改写，且更新是全有或全无的。

func TestSensitiveWordsUpdateIsAtomic(t *testing.T) {
	orig := GetSensitiveWords()
	t.Cleanup(func() { sensitiveWords.Store(&orig) })

	SensitiveWordsFromString("alpha\nbeta\ngamma")
	held := GetSensitiveWords()
	require.Equal(t, []string{"alpha", "beta", "gamma"}, held)

	SensitiveWordsFromString("delta")

	assert.Equal(t, []string{"alpha", "beta", "gamma"}, held, "已取得的列表不应被后续更新改写")
	assert.Equal(t, []string{"delta"}, GetSensitiveWords())
}

func TestSensitiveWordsFromStringSkipsBlankLines(t *testing.T) {
	orig := GetSensitiveWords()
	t.Cleanup(func() { sensitiveWords.Store(&orig) })

	SensitiveWordsFromString("  alpha  \n\n   \nbeta\n")

	assert.Equal(t, []string{"alpha", "beta"}, GetSensitiveWords())
	assert.Equal(t, "alpha\nbeta", SensitiveWordsToString())
}

func TestSensitiveWordsEmptyInputYieldsEmptyList(t *testing.T) {
	orig := GetSensitiveWords()
	t.Cleanup(func() { sensitiveWords.Store(&orig) })

	SensitiveWordsFromString("")

	assert.Empty(t, GetSensitiveWords())
	assert.Equal(t, "", SensitiveWordsToString())
}

func TestAutoGroupsUpdateIsAtomic(t *testing.T) {
	orig := GetAutoGroups()
	t.Cleanup(func() { autoGroups.Store(&orig) })

	require.NoError(t, UpdateAutoGroupsByJsonString(`["default","vip"]`))
	held := GetAutoGroups()
	require.Equal(t, []string{"default", "vip"}, held)

	require.NoError(t, UpdateAutoGroupsByJsonString(`["svip"]`))

	assert.Equal(t, []string{"default", "vip"}, held, "已取得的列表不应被后续更新改写")
	assert.Equal(t, []string{"svip"}, GetAutoGroups())
	assert.True(t, ContainsAutoGroup("svip"))
	assert.False(t, ContainsAutoGroup("vip"))
}

// 解析失败时必须保留原有列表，不能留下一个被清空的列表。
func TestAutoGroupsInvalidJsonKeepsPreviousList(t *testing.T) {
	orig := GetAutoGroups()
	t.Cleanup(func() { autoGroups.Store(&orig) })

	require.NoError(t, UpdateAutoGroupsByJsonString(`["default","vip"]`))

	require.Error(t, UpdateAutoGroupsByJsonString(`not json`))

	assert.Equal(t, []string{"default", "vip"}, GetAutoGroups(), "解析失败不应清空已生效的分组")
}

func TestChatsUpdateIsAtomic(t *testing.T) {
	orig := GetChats()
	t.Cleanup(func() { chats.Store(&orig) })

	require.NoError(t, UpdateChatsByJsonString(`[{"A":"a"},{"B":"b"}]`))
	held := GetChats()
	require.Len(t, held, 2)

	require.NoError(t, UpdateChatsByJsonString(`[{"C":"c"}]`))

	assert.Len(t, held, 2, "已取得的列表不应被后续更新改写")
	assert.Len(t, GetChats(), 1)
}

func TestChatsInvalidJsonKeepsPreviousList(t *testing.T) {
	orig := GetChats()
	t.Cleanup(func() { chats.Store(&orig) })

	require.NoError(t, UpdateChatsByJsonString(`[{"A":"a"}]`))

	require.Error(t, UpdateChatsByJsonString(`not json`))

	assert.Len(t, GetChats(), 1, "解析失败不应清空已生效的配置")
	assert.True(t, strings.Contains(Chats2JsonString(), `"A"`))
}
