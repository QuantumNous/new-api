package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func withResponsesBootstrapCacheFixture(t *testing.T, channels map[int]*Channel) {
	t.Helper()

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalChannelsIDM := channelsIDM

	common.MemoryCacheEnabled = true
	channelSyncLock.Lock()
	channelsIDM = channels
	channelSyncLock.Unlock()

	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		channelSyncLock.Lock()
		channelsIDM = originalChannelsIDM
		channelSyncLock.Unlock()
	})
}

func TestHasResponsesBootstrapRecoveryEnabledChannelSkipsDisabledChannels(t *testing.T) {
	withResponsesBootstrapCacheFixture(t, map[int]*Channel{
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
	})

	if HasResponsesBootstrapRecoveryEnabledChannel([]string{"default"}, "gpt-5") {
		t.Fatal("disabled opted-in channel should not satisfy responses bootstrap recovery")
	}
}

func TestHasResponsesBootstrapRecoveryEnabledChannelAcceptsEnabledOptInChannel(t *testing.T) {
	withResponsesBootstrapCacheFixture(t, map[int]*Channel{
		1: {
			Id:            1,
			Status:        common.ChannelStatusEnabled,
			Group:         "default",
			Models:        "gpt-5",
			OtherSettings: `{"responses_stream_bootstrap_recovery_enabled":true}`,
		},
	})

	if !HasResponsesBootstrapRecoveryEnabledChannel([]string{"default"}, "gpt-5") {
		t.Fatal("enabled opted-in channel should satisfy responses bootstrap recovery")
	}
}

func TestHasResponsesBootstrapRecoveryCandidateChannelAcceptsDisabledOptInChannel(t *testing.T) {
	withResponsesBootstrapCacheFixture(t, map[int]*Channel{
		1: {
			Id:            1,
			Status:        common.ChannelStatusManuallyDisabled,
			Group:         "default",
			Models:        "gpt-5",
			OtherSettings: `{"responses_stream_bootstrap_recovery_enabled":true}`,
		},
	})

	if !HasResponsesBootstrapRecoveryCandidateChannel([]string{"default"}, "gpt-5") {
		t.Fatal("disabled opted-in channel should remain a bootstrap recovery candidate")
	}
}

func TestHasResponsesBootstrapRecoveryCandidateChannelRejectsNonOptInChannel(t *testing.T) {
	withResponsesBootstrapCacheFixture(t, map[int]*Channel{
		1: {
			Id:            1,
			Status:        common.ChannelStatusManuallyDisabled,
			Group:         "default",
			Models:        "gpt-5",
			OtherSettings: `{"responses_stream_bootstrap_recovery_enabled":false}`,
		},
	})

	if HasResponsesBootstrapRecoveryCandidateChannel([]string{"default"}, "gpt-5") {
		t.Fatal("non-opt-in channel should not satisfy bootstrap recovery candidate lookup")
	}
}
