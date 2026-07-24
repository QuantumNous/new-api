package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestGetRandomSatisfiedChannelWithPolicyStopsAtExhaustion(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true

	channelSyncLock.Lock()
	oldGroupMap := group2model2channels
	oldChannels := channelsIDM
	group2model2channels = map[string]map[string][]int{
		"default": {
			"gpt-image-2": {25, 35},
		},
	}
	channelsIDM = map[int]*Channel{
		25: {Id: 25, Priority: common.GetPointer(int64(100)), Weight: common.GetPointer(uint(100))},
		35: {Id: 35, Priority: common.GetPointer(int64(50)), Weight: common.GetPointer(uint(100))},
	}
	channelSyncLock.Unlock()

	t.Cleanup(func() {
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		channelSyncLock.Lock()
		group2model2channels = oldGroupMap
		channelsIDM = oldChannels
		channelSyncLock.Unlock()
	})

	first, err := GetRandomSatisfiedChannelWithPolicy("default", "gpt-image-2", 0, true)
	require.NoError(t, err)
	require.Equal(t, 25, first.Id)

	second, err := GetRandomSatisfiedChannelWithPolicy("default", "gpt-image-2", 1, true)
	require.NoError(t, err)
	require.Equal(t, 35, second.Id)

	exhausted, err := GetRandomSatisfiedChannelWithPolicy("default", "gpt-image-2", 2, true)
	require.NoError(t, err)
	require.Nil(t, exhausted)

	legacy, err := GetRandomSatisfiedChannelWithPolicy("default", "gpt-image-2", 2, false)
	require.NoError(t, err)
	require.Equal(t, 35, legacy.Id)
}

func TestGetRandomSatisfiedChannelWithPolicyStopsAfterSingleCachedChannel(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true

	channelSyncLock.Lock()
	oldGroupMap := group2model2channels
	oldChannels := channelsIDM
	group2model2channels = map[string]map[string][]int{
		"default": {
			"gpt-single": {25},
		},
	}
	channelsIDM = map[int]*Channel{
		25: {Id: 25, Priority: common.GetPointer(int64(100)), Weight: common.GetPointer(uint(100))},
	}
	channelSyncLock.Unlock()

	t.Cleanup(func() {
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		channelSyncLock.Lock()
		group2model2channels = oldGroupMap
		channelsIDM = oldChannels
		channelSyncLock.Unlock()
	})

	first, err := GetRandomSatisfiedChannelWithPolicy("default", "gpt-single", 0, true)
	require.NoError(t, err)
	require.Equal(t, 25, first.Id)

	exhausted, err := GetRandomSatisfiedChannelWithPolicy("default", "gpt-single", 1, true)
	require.NoError(t, err)
	require.Nil(t, exhausted)
}
