package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func prepareChannelCacheTest(t *testing.T) {
	t.Helper()
	initCol()
	require.NoError(t, DB.AutoMigrate(&Ability{}))
	DB.Exec("DELETE FROM abilities")
	DB.Exec("DELETE FROM channels")

	channelSyncLock.Lock()
	group2model2channels = nil
	channelsIDM = nil
	channelSyncLock.Unlock()
	channelCacheRefreshInFlight.Store(false)
}

func TestGetRandomSatisfiedChannelFallsBackToDatabaseOnCacheMiss(t *testing.T) {
	prepareChannelCacheTest(t)

	prevMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = prevMemoryCacheEnabled
	})

	channel := &Channel{
		Id:     101,
		Name:   "fallback-channel",
		Status: common.ChannelStatusEnabled,
		Group:  "default",
		Models: "other-model",
	}
	require.NoError(t, DB.Create(channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "gpt-5.4",
		ChannelId: channel.Id,
		Enabled:   true,
	}).Error)

	got, err := GetRandomSatisfiedChannel("default", "gpt-5.4", 0)
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, channel.Id, got.Id)

	require.Eventually(t, func() bool {
		channelSyncLock.RLock()
		defer channelSyncLock.RUnlock()
		return isChannelIDInList(group2model2channels["default"]["gpt-5.4"], channel.Id)
	}, time.Second, 20*time.Millisecond)
}

func TestUpdateChannelStatusRefreshesMemoryCacheAfterEnable(t *testing.T) {
	prepareChannelCacheTest(t)

	prevMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = prevMemoryCacheEnabled
	})

	channel := &Channel{
		Id:     102,
		Name:   "auto-disabled-channel",
		Status: common.ChannelStatusAutoDisabled,
		Group:  "default",
		Models: "gpt-5.4",
	}
	require.NoError(t, DB.Create(channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "gpt-5.4",
		ChannelId: channel.Id,
		Enabled:   false,
	}).Error)

	InitChannelCache()

	got, err := GetRandomSatisfiedChannel("default", "gpt-5.4", 0)
	require.NoError(t, err)
	require.Nil(t, got)

	require.True(t, UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, ""))

	got, err = GetRandomSatisfiedChannel("default", "gpt-5.4", 0)
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, channel.Id, got.Id)

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()
	require.True(t, isChannelIDInList(group2model2channels["default"]["gpt-5.4"], channel.Id))
}
