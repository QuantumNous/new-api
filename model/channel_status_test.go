package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestUpdateChannelStatusDoesNotOverwriteBanned(t *testing.T) {
	setupCodexFingerprintSeedTestDB(t)
	channel := insertCodexFingerprintSeedChannel(t, 1, common.ChannelStatusBanned, "")

	require.False(t, UpdateChannelStatus(channel.Id, "", common.ChannelStatusAutoDisabled, "upstream failure"))

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	require.Equal(t, common.ChannelStatusBanned, stored.Status)
}

func TestUpdateChannelStatusDoesNotRestoreBannedAutomatically(t *testing.T) {
	setupCodexFingerprintSeedTestDB(t)
	channel := insertCodexFingerprintSeedChannel(t, 3, common.ChannelStatusBanned, "")

	require.False(t, UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, "automatic recovery"))

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	require.Equal(t, common.ChannelStatusBanned, stored.Status)
}

func TestUpdateChannelStatusCannotSetBannedAutomatically(t *testing.T) {
	setupCodexFingerprintSeedTestDB(t)
	channel := insertCodexFingerprintSeedChannel(t, 2, common.ChannelStatusEnabled, "")

	require.False(t, UpdateChannelStatus(channel.Id, "", common.ChannelStatusBanned, "upstream failure"))

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	require.Equal(t, common.ChannelStatusEnabled, stored.Status)
}

func TestMultiKeyAutomaticDisableDoesNotOverwriteBanned(t *testing.T) {
	channel := Channel{
		Status: common.ChannelStatusBanned,
		Key:    `["key-a","key-b"]`,
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
		},
	}

	handlerMultiKeyUpdate(&channel, "key-a", common.ChannelStatusAutoDisabled, "upstream failure")

	require.Equal(t, common.ChannelStatusBanned, channel.Status)
	require.Empty(t, channel.ChannelInfo.MultiKeyStatusList)
}

func TestMultiKeyAutomaticUpdateCannotSetBanned(t *testing.T) {
	channel := Channel{
		Status: common.ChannelStatusEnabled,
		Key:    `["key-a","key-b"]`,
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
		},
	}

	handlerMultiKeyUpdate(&channel, "key-a", common.ChannelStatusBanned, "upstream ban")

	require.Equal(t, common.ChannelStatusEnabled, channel.Status)
	require.Empty(t, channel.ChannelInfo.MultiKeyStatusList)
}
