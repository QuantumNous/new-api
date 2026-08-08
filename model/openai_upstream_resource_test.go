package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIUpstreamResourceIsScopedToItsOwner(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&OpenAIUpstreamResource{}))
	require.NoError(t, DB.Exec("DELETE FROM openai_upstream_resources").Error)
	t.Cleanup(func() {
		_ = DB.Exec("DELETE FROM openai_upstream_resources").Error
	})

	require.NoError(t, SaveOpenAIUpstreamResources([]OpenAIUpstreamResource{
		{
			UserId:       101,
			ChannelId:    7,
			ResourceType: OpenAIUpstreamResourceTypeFile,
			ResourceId:   "file_shared",
			Model:        "gpt-image-2",
		},
		{
			UserId:       202,
			ChannelId:    9,
			ResourceType: OpenAIUpstreamResourceTypeFile,
			ResourceId:   "file_shared",
			Model:        "gpt-image-1",
		},
	}))

	first, found, err := GetOpenAIUpstreamResource(101, OpenAIUpstreamResourceTypeFile, "file_shared")
	require.NoError(t, err)
	require.True(t, found)
	assert.Equal(t, 7, first.ChannelId)
	assert.Equal(t, "gpt-image-2", first.Model)

	second, found, err := GetOpenAIUpstreamResource(202, OpenAIUpstreamResourceTypeFile, "file_shared")
	require.NoError(t, err)
	require.True(t, found)
	assert.Equal(t, 9, second.ChannelId)
	assert.Equal(t, "gpt-image-1", second.Model)

	_, found, err = GetOpenAIUpstreamResource(303, OpenAIUpstreamResourceTypeFile, "file_shared")
	require.NoError(t, err)
	assert.False(t, found)
}

func TestSaveOpenAIUpstreamResourcesRejectsConflictingBinding(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&OpenAIUpstreamResource{}))
	require.NoError(t, DB.Exec("DELETE FROM openai_upstream_resources").Error)
	t.Cleanup(func() {
		_ = DB.Exec("DELETE FROM openai_upstream_resources").Error
	})

	resource := OpenAIUpstreamResource{
		UserId:                101,
		ChannelId:             7,
		ChannelKeyIndex:       1,
		ChannelKeyFingerprint: ChannelKeyFingerprint("key-b"),
		ResourceType:          OpenAIUpstreamResourceTypeBatch,
		ResourceId:            "batch_123",
		Model:                 "gpt-image-2",
	}
	require.NoError(t, SaveOpenAIUpstreamResources([]OpenAIUpstreamResource{resource}))
	require.NoError(t, SaveOpenAIUpstreamResources([]OpenAIUpstreamResource{resource}), "saving the same binding must be idempotent")

	resource.ChannelId = 8
	require.ErrorContains(t, SaveOpenAIUpstreamResources([]OpenAIUpstreamResource{resource}), "already belongs to another channel or key")

	stored, found, err := GetOpenAIUpstreamResource(101, OpenAIUpstreamResourceTypeBatch, "batch_123")
	require.NoError(t, err)
	require.True(t, found)
	assert.Equal(t, 7, stored.ChannelId)
	assert.Equal(t, 1, stored.ChannelKeyIndex)
	assert.Equal(t, ChannelKeyFingerprint("key-b"), stored.ChannelKeyFingerprint)
}

func TestChannelGetEnabledKeyByFingerprint(t *testing.T) {
	channel := &Channel{
		Key: "key-a\nkey-b",
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
			MultiKeyStatusList: map[int]int{
				0: common.ChannelStatusManuallyDisabled,
			},
		},
	}

	key, index, err := channel.GetEnabledKeyByFingerprint(ChannelKeyFingerprint("key-b"))
	require.Nil(t, err)
	assert.Equal(t, "key-b", key)
	assert.Equal(t, 1, index)

	_, _, err = channel.GetEnabledKeyByFingerprint(ChannelKeyFingerprint("key-a"))
	require.NotNil(t, err)
	assert.Contains(t, err.Error(), "disabled")

	_, _, err = channel.GetEnabledKeyByFingerprint(ChannelKeyFingerprint("missing"))
	require.NotNil(t, err)
	assert.Contains(t, err.Error(), "no longer exists")
}

func TestDeleteOpenAIUpstreamResourceOnlyDeletesOwnedResource(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&OpenAIUpstreamResource{}))
	require.NoError(t, DB.Exec("DELETE FROM openai_upstream_resources").Error)
	t.Cleanup(func() {
		_ = DB.Exec("DELETE FROM openai_upstream_resources").Error
	})
	require.NoError(t, SaveOpenAIUpstreamResources([]OpenAIUpstreamResource{
		{UserId: 101, ChannelId: 7, ResourceType: OpenAIUpstreamResourceTypeFile, ResourceId: "file_delete", Model: "gpt-image-2"},
		{UserId: 202, ChannelId: 7, ResourceType: OpenAIUpstreamResourceTypeFile, ResourceId: "file_delete", Model: "gpt-image-2"},
	}))

	require.NoError(t, DeleteOpenAIUpstreamResource(101, OpenAIUpstreamResourceTypeFile, "file_delete"))
	_, found, err := GetOpenAIUpstreamResource(101, OpenAIUpstreamResourceTypeFile, "file_delete")
	require.NoError(t, err)
	assert.False(t, found)
	_, found, err = GetOpenAIUpstreamResource(202, OpenAIUpstreamResourceTypeFile, "file_delete")
	require.NoError(t, err)
	assert.True(t, found)
}

func TestGetChannelForBatchUploadSkipsHigherPriorityChannelWithoutOptIn(t *testing.T) {
	previousMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		common.MemoryCacheEnabled = previousMemoryCacheEnabled
	})

	require.NoError(t, DB.AutoMigrate(&Channel{}, &Ability{}))
	channelIds := []int{9_901, 9_902}
	require.NoError(t, DB.Where("channel_id IN ?", channelIds).Delete(&Ability{}).Error)
	require.NoError(t, DB.Where("id IN ?", channelIds).Delete(&Channel{}).Error)
	t.Cleanup(func() {
		_ = DB.Where("channel_id IN ?", channelIds).Delete(&Ability{}).Error
		_ = DB.Where("id IN ?", channelIds).Delete(&Channel{}).Error
	})

	highPriority := int64(100)
	lowPriority := int64(10)
	weight := uint(100)
	unsupported := Channel{
		Id:       channelIds[0],
		Type:     constant.ChannelTypeOpenAI,
		Key:      "unsupported-key",
		Status:   common.ChannelStatusEnabled,
		Name:     "batch-unsupported",
		Group:    "batch-capability-test",
		Models:   "gpt-image-2",
		Priority: &highPriority,
		Weight:   &weight,
	}
	supported := Channel{
		Id:       channelIds[1],
		Type:     constant.ChannelTypeOpenAI,
		Key:      "supported-key",
		Status:   common.ChannelStatusEnabled,
		Name:     "batch-supported",
		Group:    "batch-capability-test",
		Models:   "gpt-image-2",
		Priority: &lowPriority,
		Weight:   &weight,
	}
	supported.SetOtherSettings(dto.ChannelOtherSettings{NativeOpenAIBatch: true})
	require.NoError(t, DB.Create(&unsupported).Error)
	require.NoError(t, DB.Create(&supported).Error)
	require.NoError(t, unsupported.AddAbilities(nil))
	require.NoError(t, supported.AddAbilities(nil))

	selected, err := GetRandomSatisfiedChannel("batch-capability-test", "gpt-image-2", 0, "/v1/files")
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, supported.Id, selected.Id)
}

func TestFilterChannelsForBatchUploadFailsClosedOnMissingCacheEntry(t *testing.T) {
	unsupported := &Channel{Id: 9_911, Type: constant.ChannelTypeOpenAI}
	supported := &Channel{Id: 9_912, Type: constant.ChannelTypeOpenAI}
	supported.SetOtherSettings(dto.ChannelOtherSettings{NativeOpenAIBatch: true})

	channelSyncLock.Lock()
	previousChannels := channelsIDM
	channelsIDM = map[int]*Channel{
		unsupported.Id: unsupported,
		supported.Id:   supported,
	}
	got := filterChannelsByRequestPathAndModel(
		[]int{unsupported.Id, 9_913, supported.Id},
		"/v1/files",
		"gpt-image-2",
	)
	channelsIDM = previousChannels
	channelSyncLock.Unlock()

	assert.Equal(t, []int{supported.Id}, got)
}
