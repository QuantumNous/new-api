package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestChannelOrderedEnabledKeyIndices_PollingDoesNotAdvanceUntilCommitted(t *testing.T) {
	withMemoryCache(t, func() {
		channel := &Channel{
			Id: 42,
			Key: "k0\nk1\nk2",
			ChannelInfo: ChannelInfo{
				IsMultiKey: true,
				MultiKeySize: 3,
				MultiKeyMode: constant.MultiKeyModePolling,
				MultiKeyPollingIndex: 1,
				MultiKeyStatusList: map[int]int{
					2: common.ChannelStatusAutoDisabled,
				},
			},
		}

		registerCachedChannel(channel)

		lock := GetChannelPollingLock(channel.Id)
		lock.Lock()
		ordered, err := channel.OrderedEnabledKeyIndices()
		lock.Unlock()
		require.Nil(t, err)
		require.Equal(t, []int{1, 0}, ordered)
		require.Equal(t, 1, channel.ChannelInfo.MultiKeyPollingIndex)

		lock.Lock()
		require.Nil(t, channel.CommitSelectedKeyIndex(ordered[0]))
		lock.Unlock()
		require.Equal(t, 2, channel.ChannelInfo.MultiKeyPollingIndex)

		channelSyncLock.RLock()
		require.Equal(t, 2, channelsIDM[channel.Id].ChannelInfo.MultiKeyPollingIndex)
		channelSyncLock.RUnlock()

		stale := *channel
		stale.ChannelInfo.MultiKeyPollingIndex = 0

		staleLock := GetChannelPollingLock(stale.Id)
		staleLock.Lock()
		staleOrdered, err := stale.OrderedEnabledKeyIndices()
		staleLock.Unlock()
		require.Nil(t, err)
		require.Equal(t, []int{0, 1}, staleOrdered)

		staleLock.Lock()
		require.Nil(t, stale.CommitSelectedKeyIndex(staleOrdered[0]))
		staleLock.Unlock()

		channelSyncLock.RLock()
		require.Equal(t, 1, channelsIDM[channel.Id].ChannelInfo.MultiKeyPollingIndex)
		channelSyncLock.RUnlock()
		require.Equal(t, 1, stale.ChannelInfo.MultiKeyPollingIndex)

		key, err := stale.KeyAt(staleOrdered[0])
		require.Nil(t, err)
		require.Equal(t, "k0", key)
	})
}

func TestChannelGetNextEnabledKey_PollingUsesCanonicalState(t *testing.T) {
	withMemoryCache(t, func() {
		channel := &Channel{
			Id: 43,
			Key: "k0\nk1\nk2",
			ChannelInfo: ChannelInfo{
				IsMultiKey: true,
				MultiKeySize: 3,
				MultiKeyMode: constant.MultiKeyModePolling,
				MultiKeyPollingIndex: 2,
				MultiKeyStatusList: map[int]int{
					2: common.ChannelStatusAutoDisabled,
				},
			},
		}

		registerCachedChannel(channel)

		key, idx, err := channel.GetNextEnabledKey()
		require.Nil(t, err)
		require.Equal(t, "k0", key)
		require.Equal(t, 0, idx)
		require.Equal(t, 1, channel.ChannelInfo.MultiKeyPollingIndex)

		key2, idx2, err := channel.GetNextEnabledKey()
		require.Nil(t, err)
		require.Equal(t, "k1", key2)
		require.Equal(t, 1, idx2)
		require.Equal(t, 2, channel.ChannelInfo.MultiKeyPollingIndex)
	})
}

func TestChannelGetNextEnabledKey_RandomUsesEnabledCandidates(t *testing.T) {
	channel := &Channel{
		Id: 44,
		Key: "k0\nk1\nk2",
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
			MultiKeySize: 3,
			MultiKeyMode: constant.MultiKeyModeRandom,
			MultiKeyPollingIndex: 5,
			MultiKeyStatusList: map[int]int{
				1: common.ChannelStatusAutoDisabled,
			},
		},
	}

	allowed := map[int]string{0: "k0", 2: "k2"}
	key, idx, err := channel.GetNextEnabledKey()
	require.Nil(t, err)
	require.Contains(t, allowed, idx)
	require.Equal(t, allowed[idx], key)
	require.Equal(t, 5, channel.ChannelInfo.MultiKeyPollingIndex)
}

func TestChannelGetNextEnabledKey_UsesCanonicalKeys(t *testing.T) {
	withMemoryCache(t, func() {
		stale := &Channel{
			Id: 45,
			Key: "old0\nold1",
			ChannelInfo: ChannelInfo{
				IsMultiKey: true,
				MultiKeySize: 2,
				MultiKeyMode: constant.MultiKeyModePolling,
				MultiKeyPollingIndex: 0,
			},
		}
		registerCachedChannel(stale)

		canonical := &Channel{
			Id: 45,
			Key: "new0\nnew1",
			ChannelInfo: ChannelInfo{
				IsMultiKey: true,
				MultiKeySize: 2,
				MultiKeyMode: constant.MultiKeyModePolling,
				MultiKeyPollingIndex: 0,
				MultiKeyStatusList: map[int]int{
					0: common.ChannelStatusAutoDisabled,
				},
			},
		}
		registerCachedChannel(canonical)

		key, idx, err := stale.GetNextEnabledKey()
		require.Nil(t, err)
		require.Equal(t, "new1", key)
		require.Equal(t, 1, idx)
		require.Equal(t, 1, canonical.ChannelInfo.MultiKeyPollingIndex)
	})
}

func TestChannelGetNextEnabledKey_ReturnsKeyWhenNotMultiKey(t *testing.T) {
	channel := &Channel{
		Key: "single",
	}

	key, idx, err := channel.GetNextEnabledKey()
	require.Nil(t, err)
	require.Equal(t, "single", key)
	require.Equal(t, 0, idx)
}

func withMemoryCache(t *testing.T, run func()) {
	original := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	defer func() {
		common.MemoryCacheEnabled = original
	}()

	channelSyncLock.Lock()
	previous := channelsIDM
	channelsIDM = map[int]*Channel{}
	channelSyncLock.Unlock()

	defer func() {
		channelSyncLock.Lock()
		channelsIDM = previous
		channelSyncLock.Unlock()
	}()

	run()
}

func registerCachedChannel(channel *Channel) {
	channelSyncLock.Lock()
	if channelsIDM == nil {
		channelsIDM = map[int]*Channel{}
	}
	channelsIDM[channel.Id] = channel
	channelSyncLock.Unlock()
}
