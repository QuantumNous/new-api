package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestChannelSelectionUsesLowerPriorityAfterRetry(t *testing.T) {
	const (
		group     = "priority-selection-test"
		modelName = "priority-selection-model"
	)

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		DB.Where(commonGroupCol+" = ? AND model = ?", group, modelName).Delete(&Ability{})
		DB.Where("id IN ?", []int{9101, 9102}).Delete(&Channel{})
	})

	insertPrioritySelectionCandidate(t, 9101, group, modelName, 100)
	insertPrioritySelectionCandidate(t, 9102, group, modelName, 10)

	channel, err := GetChannel(group, modelName, 0, "")
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 9101, channel.Id)

	channel, err = GetChannel(group, modelName, 1, "")
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 9102, channel.Id)
}

func TestChannelCacheUsesLowerPriorityAfterRetry(t *testing.T) {
	const (
		group     = "priority-cache-retry-test"
		modelName = "priority-cache-retry-model"
	)

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		DB.Where(commonGroupCol+" = ? AND model = ?", group, modelName).Delete(&Ability{})
		DB.Where("id IN ?", []int{9251, 9252}).Delete(&Channel{})
		InitChannelCache()
	})

	insertPrioritySelectionCandidate(t, 9251, group, modelName, 100)
	insertPrioritySelectionCandidate(t, 9252, group, modelName, 10)
	InitChannelCache()

	channel, err := GetRandomSatisfiedChannel(group, modelName, 0, "")
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 9251, channel.Id)

	channel, err = GetRandomSatisfiedChannel(group, modelName, 1, "")
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 9252, channel.Id)
}

func TestChannelCacheIgnoresDisabledAbilitiesWhenSelectingPriority(t *testing.T) {
	const (
		group     = "priority-cache-test"
		modelName = "priority-cache-model"
	)

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		DB.Where(commonGroupCol+" = ? AND model = ?", group, modelName).Delete(&Ability{})
		DB.Where("id IN ?", []int{9201, 9202}).Delete(&Channel{})
		InitChannelCache()
	})

	insertPrioritySelectionCandidate(t, 9201, group, modelName, 100)
	insertPrioritySelectionCandidate(t, 9202, group, modelName, 10)
	require.NoError(t, DB.Model(&Ability{}).
		Where("channel_id = ? AND "+commonGroupCol+" = ? AND model = ?", 9201, group, modelName).
		Update("enabled", false).Error)

	InitChannelCache()
	channel, err := GetRandomSatisfiedChannel(group, modelName, 0, "")
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 9202, channel.Id)
}

func insertPrioritySelectionCandidate(t *testing.T, channelID int, group string, modelName string, priority int64) {
	t.Helper()
	channel := &Channel{
		Id:       channelID,
		Key:      fmt.Sprintf("priority-key-%d", channelID),
		Status:   common.ChannelStatusEnabled,
		Models:   modelName,
		Group:    group,
		Priority: &priority,
	}
	require.NoError(t, DB.Create(channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group:     group,
		Model:     modelName,
		ChannelId: channelID,
		Enabled:   true,
		Priority:  &priority,
		Weight:    0,
	}).Error)
}

func TestChannelCacheUsesAbilityPriority(t *testing.T) {
	const (
		group     = "priority-cache-source-test"
		modelName = "priority-cache-source-model"
	)

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		DB.Where(commonGroupCol+" = ? AND model = ?", group, modelName).Delete(&Ability{})
		DB.Where("id IN ?", []int{9271, 9272}).Delete(&Channel{})
		InitChannelCache()
	})

	channelPriority := int64(0)
	reversedChannelPriority := int64(100)
	require.NoError(t, DB.Create(&Channel{Id: 9271, Key: "priority-source-key-9271", Status: common.ChannelStatusEnabled, Models: modelName, Group: group, Priority: &channelPriority}).Error)
	require.NoError(t, DB.Create(&Channel{Id: 9272, Key: "priority-source-key-9272", Status: common.ChannelStatusEnabled, Models: modelName, Group: group, Priority: &reversedChannelPriority}).Error)
	abilityPriority := int64(100)
	lowerAbilityPriority := int64(10)
	require.NoError(t, DB.Create(&Ability{Group: group, Model: modelName, ChannelId: 9271, Enabled: true, Priority: &abilityPriority}).Error)
	require.NoError(t, DB.Create(&Ability{Group: group, Model: modelName, ChannelId: 9272, Enabled: true, Priority: &lowerAbilityPriority}).Error)

	InitChannelCache()
	channel, err := GetRandomSatisfiedChannel(group, modelName, 0, "")
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 9271, channel.Id)

	channel.Name = "updated-priority-source-channel"
	CacheUpdateChannel(channel)
	channel, err = GetRandomSatisfiedChannel(group, modelName, 0, "")
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 9271, channel.Id)
}

func TestChannelSelectionFallsBackWhenHigherPriorityRouteIsIneligible(t *testing.T) {
	const (
		group     = "priority-route-test"
		modelName = "priority-route-model"
	)

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		DB.Where(commonGroupCol+" = ? AND model = ?", group, modelName).Delete(&Ability{})
		DB.Where("id IN ?", []int{9301, 9302, 9303}).Delete(&Channel{})
	})

	higherPriority := &Channel{
		Id:       9301,
		Type:     constant.ChannelTypeAdvancedCustom,
		Key:      "priority-route-key-9301",
		Status:   common.ChannelStatusEnabled,
		Models:   modelName,
		Group:    group,
		Priority: common.GetPointer(int64(100)),
	}
	higherPriority.SetOtherSettings(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{{IncomingPath: "/v1/responses", UpstreamPath: "/v1/responses"}},
	}})
	mediumPriority := &Channel{
		Id:       9302,
		Key:      "priority-route-key-9302",
		Status:   common.ChannelStatusEnabled,
		Models:   modelName,
		Group:    group,
		Priority: common.GetPointer(int64(20)),
	}
	lowerPriority := &Channel{
		Id:       9303,
		Key:      "priority-route-key-9303",
		Status:   common.ChannelStatusEnabled,
		Models:   modelName,
		Group:    group,
		Priority: common.GetPointer(int64(10)),
	}
	require.NoError(t, DB.Create(higherPriority).Error)
	require.NoError(t, DB.Create(mediumPriority).Error)
	require.NoError(t, DB.Create(lowerPriority).Error)
	require.NoError(t, DB.Create(&Ability{Group: group, Model: modelName, ChannelId: 9301, Enabled: true, Priority: common.GetPointer(int64(100))}).Error)
	require.NoError(t, DB.Create(&Ability{Group: group, Model: modelName, ChannelId: 9302, Enabled: true, Priority: common.GetPointer(int64(20))}).Error)
	require.NoError(t, DB.Create(&Ability{Group: group, Model: modelName, ChannelId: 9303, Enabled: true, Priority: common.GetPointer(int64(10))}).Error)

	channel, err := GetChannel(group, modelName, 0, "/v1/chat/completions")
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 9302, channel.Id)

	channel, err = GetChannel(group, modelName, 1, "/v1/chat/completions")
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 9303, channel.Id)
}
