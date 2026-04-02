package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestGetRandomSatisfiedChannelSkipsFilteredHighPriority(t *testing.T) {
	prevMemoryCacheEnabled := common.MemoryCacheEnabled

	channelSyncLock.Lock()
	prevGroup2Model2Channels := group2model2channels
	prevChannelsIDM := channelsIDM
	channelSyncLock.Unlock()

	common.MemoryCacheEnabled = true

	highPriority := int64(10)
	lowPriority := int64(5)
	weight := uint(1)

	channelSyncLock.Lock()
	group2model2channels = map[string]map[string][]int{
		"default": {
			"gpt-test": {1, 2},
		},
	}
	channelsIDM = map[int]*Channel{
		1: {Id: 1, Priority: &highPriority, Weight: &weight},
		2: {Id: 2, Priority: &lowPriority, Weight: &weight},
	}
	channelSyncLock.Unlock()

	t.Cleanup(func() {
		common.MemoryCacheEnabled = prevMemoryCacheEnabled
		channelSyncLock.Lock()
		group2model2channels = prevGroup2Model2Channels
		channelsIDM = prevChannelsIDM
		channelSyncLock.Unlock()
	})

	channel, err := GetRandomSatisfiedChannel("default", "gpt-test", 0, func(channel *Channel) bool {
		return channel.Id != 1
	})
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 2, channel.Id)
}
