package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRandomSatisfiedChannelExcludesFailedChannels(t *testing.T) {
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	channelSyncLock.Lock()
	originalGroup2Model2Channels := group2model2channels
	originalChannelsIDM := channelsIDM
	originalAdvancedConfigs := channel2advancedCustomConfig
	priority100 := int64(100)
	priority90 := int64(90)
	priority80 := int64(80)
	weight := uint(10)
	group2model2channels = map[string]map[string][]int{
		"vip": {"model-a": {1, 2, 3}},
	}
	channelsIDM = map[int]*Channel{
		1: {Id: 1, Status: common.ChannelStatusEnabled, Priority: &priority100, Weight: &weight},
		2: {Id: 2, Status: common.ChannelStatusEnabled, Priority: &priority90, Weight: &weight},
		3: {Id: 3, Status: common.ChannelStatusEnabled, Priority: &priority80, Weight: &weight},
	}
	channel2advancedCustomConfig = nil
	channelSyncLock.Unlock()
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		channelSyncLock.Lock()
		group2model2channels = originalGroup2Model2Channels
		channelsIDM = originalChannelsIDM
		channel2advancedCustomConfig = originalAdvancedConfigs
		channelSyncLock.Unlock()
	})

	channel, err := GetRandomSatisfiedChannel("vip", "model-a", 5, "", ChannelSelectionOptions{ExcludedChannelIds: []int{1}})
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 2, channel.Id)

	channel, err = GetRandomSatisfiedChannel("vip", "model-a", 0, "", ChannelSelectionOptions{ExcludedChannelIds: []int{1, 2}})
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 3, channel.Id)

	channel, err = GetRandomSatisfiedChannel("vip", "model-a", 0, "", ChannelSelectionOptions{ExcludedChannelIds: []int{1, 2, 3}})
	require.NoError(t, err)
	assert.Nil(t, channel)
}

func TestGetRandomSatisfiedChannelExcludesFailedChannelsWithoutMemoryCache(t *testing.T) {
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
	})

	channelIDs := []int{9101, 9102, 9103}
	require.NoError(t, DB.Where("channel_id IN ?", channelIDs).Delete(&Ability{}).Error)
	require.NoError(t, DB.Where("id IN ?", channelIDs).Delete(&Channel{}).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Where("channel_id IN ?", channelIDs).Delete(&Ability{}).Error)
		require.NoError(t, DB.Where("id IN ?", channelIDs).Delete(&Channel{}).Error)
	})

	priority100 := int64(100)
	priority90 := int64(90)
	priority80 := int64(80)
	weight := uint(10)
	require.NoError(t, DB.Create(&[]Channel{
		{Id: 9101, Name: "first", Group: "vip", Models: "model-a", Status: common.ChannelStatusEnabled, Priority: &priority100, Weight: &weight},
		{Id: 9102, Name: "second", Group: "vip", Models: "model-a", Status: common.ChannelStatusEnabled, Priority: &priority90, Weight: &weight},
		{Id: 9103, Name: "third", Group: "vip", Models: "model-a", Status: common.ChannelStatusEnabled, Priority: &priority80, Weight: &weight},
	}).Error)
	require.NoError(t, DB.Create(&[]Ability{
		{Group: "vip", Model: "model-a", ChannelId: 9101, Enabled: true, Priority: &priority100, Weight: weight},
		{Group: "vip", Model: "model-a", ChannelId: 9102, Enabled: true, Priority: &priority90, Weight: weight},
		{Group: "vip", Model: "model-a", ChannelId: 9103, Enabled: true, Priority: &priority80, Weight: weight},
	}).Error)

	channel, err := GetRandomSatisfiedChannel("vip", "model-a", 5, "", ChannelSelectionOptions{ExcludedChannelIds: []int{9101}})
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 9102, channel.Id)

	channel, err = GetRandomSatisfiedChannel("vip", "model-a", 5, "", ChannelSelectionOptions{ExcludedChannelIds: channelIDs})
	require.NoError(t, err)
	assert.Nil(t, channel)
}
