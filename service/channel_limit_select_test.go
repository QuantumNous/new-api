package service

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// TestSelectChannelWithLimits_GateHandleReleaseIsSafe exercises the
// GateHandle.Release contract that the relay loop depends on: the handle must
// be safe to Release even when no slot was ever acquired (nil receiver, empty
// GateKeys), and Release must hand the slot back so the gate is reusable. We
// drive the gate helpers directly to avoid spinning up the channel cache (the
// orchestrator's full loop still needs integration coverage elsewhere).
func TestSelectChannelWithLimits_GateHandleReleaseIsSafe(t *testing.T) {
	// nil receiver must not panic
	var h *GateHandle // nil
	h.Release()
	require.Nil(t, h)

	// empty GateKeys slice — Release is a no-op
	h = &GateHandle{}
	h.Release()
	require.Nil(t, h.GateKeys)

	// acquire one slot via TryAcquireConcurrency, record it on a handle,
	// Release it, and assert the slot is reusable by a fresh acquire.
	const key = "test:safe-release"
	require.True(t, TryAcquireConcurrency(key, 1), "first acquire must succeed")

	h = &GateHandle{GateKeys: []string{key}}
	require.False(t, TryAcquireConcurrency(key, 1), "gate must be full before Release")

	h.Release()
	// After release, a fresh acquire must succeed.
	require.True(t, TryAcquireConcurrency(key, 1), "slot must be reusable after Release")
	ReleaseConcurrency(key)
}

func TestSelectChannelWithLimits_FailedConcurrencyAcquireSkipsAndExcludes(t *testing.T) {
	// fill the per-channel semaphore to capacity
	const ch = 9302
	gate := channelGateKey(ch, -1)
	require.True(t, TryAcquireConcurrency(gate, 1))
	t.Cleanup(func() { ReleaseConcurrency(gate) })

	excluded := map[int]bool{}
	lim := ChannelLimits{Enabled: true, MaxConcurrency: 1}
	skip := evaluateChannelForLimits(ch, -1, lim, excluded)
	require.True(t, skip)
	require.True(t, excluded[ch])
}

func TestSelectChannelWithLimits_DisabledLimitAllowsEverything(t *testing.T) {
	excluded := map[int]bool{}
	lim := ChannelLimits{Enabled: false}
	skip := evaluateChannelForLimits(9303, -1, lim, excluded)
	require.False(t, skip)
}

func TestLeastLoadedChannelsReturnsOnlyMinimumOccupancy(t *testing.T) {
	setting := `{"max_concurrency":3}`
	channels := []*model.Channel{
		{Id: 9411, Setting: common.GetPointer(setting)},
		{Id: 9412, Setting: common.GetPointer(setting)},
		{Id: 9413, Setting: common.GetPointer(setting)},
	}
	require.True(t, TryAcquireConcurrency(channelGateKey(9411, -1), 3))
	require.True(t, TryAcquireConcurrency(channelGateKey(9413, -1), 3))
	t.Cleanup(func() {
		ReleaseConcurrency(channelGateKey(9411, -1))
		ReleaseConcurrency(channelGateKey(9413, -1))
	})

	leastLoaded := leastLoadedChannels(channels)
	require.Len(t, leastLoaded, 1)
	require.Equal(t, 9412, leastLoaded[0].Id)
}

func TestLeastLoadedChannelsExcludesFullChannels(t *testing.T) {
	setting := `{"max_concurrency":1}`
	channels := []*model.Channel{
		{Id: 9421, Setting: common.GetPointer(setting)},
		{Id: 9422, Setting: common.GetPointer(setting)},
	}
	require.True(t, TryAcquireConcurrency(channelGateKey(9421, -1), 1))
	t.Cleanup(func() { ReleaseConcurrency(channelGateKey(9421, -1)) })

	leastLoaded := leastLoadedChannels(channels)
	require.Len(t, leastLoaded, 1)
	require.Equal(t, 9422, leastLoaded[0].Id)
}

func insertChannelSelectionCandidate(t *testing.T, channelID int, priority int64, maxConcurrency int) {
	t.Helper()
	setting := fmt.Sprintf(`{"max_concurrency":%d}`, maxConcurrency)
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:       channelID,
		Name:     fmt.Sprintf("channel-%d", channelID),
		Key:      fmt.Sprintf("key-%d", channelID),
		Status:   common.ChannelStatusEnabled,
		Priority: &priority,
		Setting:  common.GetPointer(setting),
	}).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "glm-routing-test",
		Model:     "glm-4",
		ChannelId: channelID,
		Enabled:   true,
		Priority:  &priority,
		Weight:    100,
	}).Error)
}

func prepareChannelSelectionTest(t *testing.T, channelIDs ...int) {
	t.Helper()
	require.NoError(t, model.DB.AutoMigrate(&model.Ability{}))
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	originalLimitEnabled := operation_setting.GetChannelLimitSetting().Enabled
	operation_setting.GetChannelLimitSetting().Enabled = true
	t.Cleanup(func() {
		model.DB.Where("channel_id IN ?", channelIDs).Delete(&model.Ability{})
		model.DB.Where("id IN ?", channelIDs).Delete(&model.Channel{})
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		operation_setting.GetChannelLimitSetting().Enabled = originalLimitEnabled
	})
}

func TestSelectChannelWithLimits_SelectsLeastLoadedChannel(t *testing.T) {
	prepareChannelSelectionTest(t, 9431, 9432, 9433)
	insertChannelSelectionCandidate(t, 9431, 10, 2)
	insertChannelSelectionCandidate(t, 9432, 10, 2)
	insertChannelSelectionCandidate(t, 9433, 10, 2)
	require.True(t, TryAcquireConcurrency(channelGateKey(9431, -1), 2))
	require.True(t, TryAcquireConcurrency(channelGateKey(9433, -1), 2))
	t.Cleanup(func() {
		ReleaseConcurrency(channelGateKey(9431, -1))
		ReleaseConcurrency(channelGateKey(9433, -1))
	})

	channel, _, handle, err := SelectChannelWithLimits(&RetryParam{
		Ctx:        &gin.Context{},
		TokenGroup: "glm-routing-test",
		ModelName:  "glm-4",
	})
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 9432, channel.Id)
	handle.Release()
}

func TestSelectChannelWithLimits_FallsThroughWhenTopPriorityIsFull(t *testing.T) {
	prepareChannelSelectionTest(t, 9441, 9442)
	insertChannelSelectionCandidate(t, 9441, 10, 1)
	insertChannelSelectionCandidate(t, 9442, 5, 1)
	require.True(t, TryAcquireConcurrency(channelGateKey(9441, -1), 1))
	t.Cleanup(func() { ReleaseConcurrency(channelGateKey(9441, -1)) })

	channel, _, handle, err := SelectChannelWithLimits(&RetryParam{
		Ctx:        &gin.Context{},
		TokenGroup: "glm-routing-test",
		ModelName:  "glm-4",
	})
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 9442, channel.Id)
	handle.Release()
}
