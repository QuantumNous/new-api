package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestHasResponsesBootstrapRecoveryEnabledChannelSkipsDisabledChannels(t *testing.T) {
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalChannelsIDM := channelsIDM

	common.MemoryCacheEnabled = true
	channelSyncLock.Lock()
	channelsIDM = map[int]*Channel{
		1: {
			Id:            1,
			Status:        common.ChannelStatusManuallyDisabled,
			Group:         "default",
			Models:        "gpt-5",
			OtherSettings: `{"responses_stream_bootstrap_recovery_enabled":true}`,
		},
		2: {
			Id:            2,
			Status:        common.ChannelStatusEnabled,
			Group:         "default",
			Models:        "gpt-5",
			OtherSettings: `{"responses_stream_bootstrap_recovery_enabled":false}`,
		},
	}
	channelSyncLock.Unlock()

	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		channelSyncLock.Lock()
		channelsIDM = originalChannelsIDM
		channelSyncLock.Unlock()
	})

	if HasResponsesBootstrapRecoveryEnabledChannel([]string{"default"}, "gpt-5") {
		t.Fatal("disabled opted-in channel should not satisfy responses bootstrap recovery")
	}
}

func TestHasResponsesBootstrapRecoveryEnabledChannelAcceptsEnabledOptInChannel(t *testing.T) {
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalChannelsIDM := channelsIDM

	common.MemoryCacheEnabled = true
	channelSyncLock.Lock()
	channelsIDM = map[int]*Channel{
		1: {
			Id:            1,
			Status:        common.ChannelStatusEnabled,
			Group:         "default",
			Models:        "gpt-5",
			OtherSettings: `{"responses_stream_bootstrap_recovery_enabled":true}`,
		},
	}
	channelSyncLock.Unlock()

	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		channelSyncLock.Lock()
		channelsIDM = originalChannelsIDM
		channelSyncLock.Unlock()
	})

	if !HasResponsesBootstrapRecoveryEnabledChannel([]string{"default"}, "gpt-5") {
		t.Fatal("enabled opted-in channel should satisfy responses bootstrap recovery")
	}
}
