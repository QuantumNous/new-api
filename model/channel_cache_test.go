package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 渠道启用但其分组在 abilities 表里没有任何记录时（直接改库、建渠道时写 abilities 半途失败），
// 内存缓存重建曾对 nil map 赋值 panic，进程每个同步周期崩一次。
func TestInitChannelCacheToleratesEnabledChannelWithoutAbilities(t *testing.T) {
	require.NoError(t, DB.Exec("DELETE FROM abilities").Error)
	require.NoError(t, DB.Exec("DELETE FROM channels").Error)
	prevEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = prevEnabled
		require.NoError(t, DB.Exec("DELETE FROM channels").Error)
	})

	orphan := &Channel{Type: 1, Key: "k", Status: common.ChannelStatusEnabled, Name: "orphan", Group: "orphan-group", Models: "m1"}
	require.NoError(t, DB.Create(orphan).Error)

	require.NotPanics(t, InitChannelCache)

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()
	assert.Equal(t, []int{orphan.Id}, group2model2channels["orphan-group"]["m1"], "渠道表是内存路由表的数据源，孤儿分组也应可路由")
}
