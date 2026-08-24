package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupChannelCacheAbilityTest(t *testing.T) {
	t.Helper()
	truncateTables(t)

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
	})
}

func TestInitChannelCacheHonorsAbilityEnabled(t *testing.T) {
	setupChannelCacheAbilityTest(t)

	channel := &Channel{
		Id:     2201,
		Key:    "cache-ability-key",
		Name:   "cache-ability-channel",
		Status: common.ChannelStatusEnabled,
		Group:  "default",
		Models: "cache-ability-model",
	}
	require.NoError(t, DB.Create(channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "cache-ability-model",
		ChannelId: channel.Id,
		Enabled:   false,
	}).Error)

	InitChannelCache()

	selected, err := GetRandomSatisfiedChannel("default", "cache-ability-model", 0, "")
	require.NoError(t, err)
	assert.Nil(t, selected)
	assert.False(t, IsChannelEnabledForGroupModel("default", "cache-ability-model", channel.Id))

	require.NoError(t, DB.Model(&Ability{}).
		Where(commonGroupCol+" = ? AND model = ? AND channel_id = ?", "default", "cache-ability-model", channel.Id).
		Update("enabled", true).Error)
	InitChannelCache()

	selected, err = GetRandomSatisfiedChannel("default", "cache-ability-model", 0, "")
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, channel.Id, selected.Id)
	assert.True(t, IsChannelEnabledForGroupModel("default", "cache-ability-model", channel.Id))
}
