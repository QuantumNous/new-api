package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGetRandomSatisfiedChannelExcludesFailedAndUsesHighestRemainingPriority
// verifies that cache retries never return an excluded channel or skip a priority tier.
func TestGetRandomSatisfiedChannelExcludesFailedAndUsesHighestRemainingPriority(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true

	channelSyncLock.Lock()
	oldGroups := group2model2channels
	oldChannels := channelsIDM
	oldAdvanced := channel2advancedCustomConfig
	priority30, priority28, priority27 := int64(30), int64(28), int64(27)
	weight := uint(10)
	group2model2channels = map[string]map[string][]int{
		"default": {"gpt-test": {1, 2, 3}},
	}
	channelsIDM = map[int]*Channel{
		1: {Id: 1, Status: common.ChannelStatusEnabled, Priority: &priority30, Weight: &weight},
		2: {Id: 2, Status: common.ChannelStatusEnabled, Priority: &priority28, Weight: &weight},
		3: {Id: 3, Status: common.ChannelStatusEnabled, Priority: &priority27, Weight: &weight},
	}
	channel2advancedCustomConfig = make(map[int]*dto.AdvancedCustomConfig)
	channelSyncLock.Unlock()

	t.Cleanup(func() {
		channelSyncLock.Lock()
		group2model2channels = oldGroups
		channelsIDM = oldChannels
		channel2advancedCustomConfig = oldAdvanced
		channelSyncLock.Unlock()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	channel, err := GetRandomSatisfiedChannel("default", "gpt-test", 1, "/v1/chat/completions", map[int]struct{}{1: {}})
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 2, channel.Id)

	channel, err = GetRandomSatisfiedChannel("default", "gpt-test", 2, "/v1/chat/completions", map[int]struct{}{1: {}, 2: {}})
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 3, channel.Id)

	channel, err = GetRandomSatisfiedChannel("default", "gpt-test", 3, "/v1/chat/completions", map[int]struct{}{1: {}, 2: {}, 3: {}})
	require.NoError(t, err)
	assert.Nil(t, channel)
}

// TestGetRandomSatisfiedChannelDatabasePathExcludesFailedChannels verifies the
// no-cache path applies the same exclusion contract as in-memory selection.
func TestGetRandomSatisfiedChannelDatabasePathExcludesFailedChannels(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = oldMemoryCacheEnabled })

	const (
		group     = "retry-db-test"
		modelName = "retry-db-model"
		firstID   = 720001
		secondID  = 720002
	)
	require.NoError(t, DB.AutoMigrate(&Channel{}, &Ability{}))
	t.Cleanup(func() {
		DB.Where(commonGroupCol+" = ? AND model = ?", group, modelName).Delete(&Ability{})
		DB.Where("id IN ?", []int{firstID, secondID}).Delete(&Channel{})
	})

	priorityHigh := int64(20)
	priorityLow := int64(10)
	weight := uint(10)
	require.NoError(t, DB.Create(&Channel{Id: firstID, Name: "retry-db-first", Status: common.ChannelStatusEnabled}).Error)
	require.NoError(t, DB.Create(&Channel{Id: secondID, Name: "retry-db-second", Status: common.ChannelStatusEnabled}).Error)
	require.NoError(t, DB.Create(&[]Ability{
		{Group: group, Model: modelName, ChannelId: firstID, Enabled: true, Priority: &priorityHigh, Weight: weight},
		{Group: group, Model: modelName, ChannelId: secondID, Enabled: true, Priority: &priorityLow, Weight: weight},
	}).Error)

	channel, err := GetRandomSatisfiedChannel(group, modelName, 1, "/v1/chat/completions", map[int]struct{}{firstID: {}})
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, secondID, channel.Id)

	channel, err = GetRandomSatisfiedChannel(group, modelName, 2, "/v1/chat/completions", map[int]struct{}{firstID: {}, secondID: {}})
	require.NoError(t, err)
	assert.Nil(t, channel)
}
