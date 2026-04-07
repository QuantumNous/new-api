package model

import (
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func prepareChannelCacheTest(t *testing.T) {
	t.Helper()
	initCol()
	require.NoError(t, DB.AutoMigrate(&Ability{}))
	require.NoError(t, DB.Exec("DELETE FROM abilities").Error)
	require.NoError(t, DB.Exec("DELETE FROM channels").Error)

	channelSyncLock.Lock()
	group2model2channels = nil
	channelsIDM = nil
	channelSyncLock.Unlock()
	channelCacheRefreshInFlight.Store(false)
	channelCacheRefreshPending.Store(false)
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

func TestIsChannelEnabledForGroupModelFallsBackToDatabaseOnCacheMiss(t *testing.T) {
	prepareChannelCacheTest(t)

	prevMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = prevMemoryCacheEnabled
	})

	channel := &Channel{
		Id:     103,
		Name:   "satisfy-fallback-channel",
		Status: common.ChannelStatusEnabled,
		Group:  "default",
		Models: "other-model",
	}
	require.NoError(t, DB.Create(channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "gpt-5.4-mini",
		ChannelId: channel.Id,
		Enabled:   true,
	}).Error)

	require.True(t, IsChannelEnabledForGroupModel("default", "gpt-5.4-mini", channel.Id))
}

func TestInitChannelCacheKeepsPreviousSnapshotOnScanError(t *testing.T) {
	prepareChannelCacheTest(t)

	prevMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = prevMemoryCacheEnabled
	})

	channel := &Channel{
		Id:     104,
		Name:   "stable-cache-channel",
		Status: common.ChannelStatusEnabled,
		Group:  "default",
		Models: "gpt-5.4",
	}
	require.NoError(t, DB.Create(channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "gpt-5.4",
		ChannelId: channel.Id,
		Enabled:   true,
	}).Error)

	InitChannelCache()

	require.NoError(t, DB.Exec(
		fmt.Sprintf(
			"INSERT INTO channels (id, type, %s, status, name, models, %s, channel_info, settings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			commonKeyCol,
			commonGroupCol,
		),
		999,
		1,
		"broken-key",
		common.ChannelStatusEnabled,
		"broken-channel",
		"broken-model",
		"default",
		`{invalid`,
		"",
	).Error)

	InitChannelCache()

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()
	require.True(t, isChannelIDInList(group2model2channels["default"]["gpt-5.4"], channel.Id))
	require.Nil(t, channelsIDM[999])
}

func TestChannelInfoScanSupportsStringValue(t *testing.T) {
	var info ChannelInfo
	err := info.Scan(`{"is_multi_key":false,"multi_key_size":0,"multi_key_status_list":{},"multi_key_disabled_reason":{},"multi_key_disabled_time":{},"multi_key_polling_index":0,"multi_key_mode":"random"}`)
	require.NoError(t, err)
	require.False(t, info.IsMultiKey)
	require.Equal(t, 0, info.MultiKeySize)
	require.Equal(t, 0, info.MultiKeyPollingIndex)
	require.Equal(t, "random", string(info.MultiKeyMode))
}
