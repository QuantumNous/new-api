package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func withChannelCacheTestState(t *testing.T) {
	t.Helper()
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalGroup2Model2Channels := group2model2channels
	originalChannelsIDM := channelsIDM

	common.MemoryCacheEnabled = true
	group2model2channels = map[string]map[string][]int{}
	channelsIDM = map[int]*Channel{}

	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		group2model2channels = originalGroup2Model2Channels
		channelsIDM = originalChannelsIDM
	})
}

func TestUpdateChannelStatusEvictsMultiKeyChannelFromRouteCache(t *testing.T) {
	withChannelCacheTestState(t)

	channelsIDM = map[int]*Channel{
		1: {
			Id:     1,
			Status: common.ChannelStatusEnabled,
			Key:    "k1",
			Group:  "default",
			Models: "gpt-test",
			ChannelInfo: ChannelInfo{
				IsMultiKey:         true,
				MultiKeySize:       1,
				MultiKeyStatusList: map[int]int{},
			},
		},
		2: {
			Id:     2,
			Status: common.ChannelStatusEnabled,
			Group:  "default",
			Models: "gpt-test",
		},
	}
	group2model2channels = map[string]map[string][]int{
		"default": {"gpt-test": {1, 2}},
	}

	cache := channelsIDM[1]
	pollingLock := GetChannelPollingLock(cache.Id)
	pollingLock.Lock()
	beforeStatus := cache.Status
	handlerMultiKeyUpdate(cache, "k1", common.ChannelStatusAutoDisabled, "test reason")
	pollingLock.Unlock()
	require.NotEqual(t, beforeStatus, cache.Status, "channel should auto-disable when all keys are disabled")
	CacheUpdateChannelStatus(cache.Id, cache.Status)

	assert.NotContains(t, group2model2channels["default"]["gpt-test"], 1,
		"auto-disabled multi-key channel should be removed from route cache")

	channel, err := GetRandomSatisfiedChannel("default", "gpt-test", 0)
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 2, channel.Id)
}
