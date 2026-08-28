package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestChannelKeyCooldown_MarkIsClear(t *testing.T) {
	channelKeyCooldown.Range(func(k, _ any) bool {
		channelKeyCooldown.Delete(k)
		return true
	})

	require.False(t, IsChannelKeyCoolingDown(100, 0))

	MarkChannelKeyCooldown(100, 0, 30)
	require.True(t, IsChannelKeyCoolingDown(100, 0))
	// Different key index of the same channel is independent.
	require.False(t, IsChannelKeyCoolingDown(100, 1))

	ClearChannelKeyCooldown(100, 0)
	require.False(t, IsChannelKeyCoolingDown(100, 0))
}

func TestChannelKeyCooldown_Expiry(t *testing.T) {
	// A cooldown that already expired must read as not cooling down and be
	// cleaned up lazily.
	channelKeyCooldown.Store(channelKeyCooldownMapKey(101, 0), time.Now().Unix()-1)
	require.False(t, IsChannelKeyCoolingDown(101, 0))
	_, ok := channelKeyCooldown.Load(channelKeyCooldownMapKey(101, 0))
	require.False(t, ok)
}

func TestChannelKeyCooldown_Clamp(t *testing.T) {
	channelKeyCooldown.Range(func(k, _ any) bool {
		channelKeyCooldown.Delete(k)
		return true
	})

	// Oversized hint is clamped so a hostile header cannot park a key forever.
	MarkChannelKeyCooldown(102, 0, MaxChannelCooldownSeconds+10_000)
	v, _ := channelKeyCooldown.Load(channelKeyCooldownMapKey(102, 0))
	until, _ := v.(int64)
	maxUntil := time.Now().Unix() + int64(MaxChannelCooldownSeconds)
	require.LessOrEqual(t, until, maxUntil)
}

func TestEnabledKeysAllCoolingDown_SingleKey(t *testing.T) {
	channelKeyCooldown.Range(func(k, _ any) bool {
		channelKeyCooldown.Delete(k)
		return true
	})
	ch := &Channel{Id: 200, Key: "k1"}

	require.False(t, ch.EnabledKeysAllCoolingDown())
	MarkChannelKeyCooldown(200, 0, 30)
	require.True(t, ch.EnabledKeysAllCoolingDown())
}

func TestEnabledKeysAllCoolingDown_MultiKey(t *testing.T) {
	channelKeyCooldown.Range(func(k, _ any) bool {
		channelKeyCooldown.Delete(k)
		return true
	})
	ch := &Channel{Id: 201, Key: "k1\nk2\nk3"}
	ch.ChannelInfo.IsMultiKey = true

	// One of three keys cooling -> channel still has ready keys.
	MarkChannelKeyCooldown(201, 0, 30)
	require.False(t, ch.EnabledKeysAllCoolingDown())
	// All three cooling -> all-cooling.
	MarkChannelKeyCooldown(201, 1, 30)
	MarkChannelKeyCooldown(201, 2, 30)
	require.True(t, ch.EnabledKeysAllCoolingDown())
}

func TestEnabledKeysAllCoolingDown_SkipsDisabledKeys(t *testing.T) {
	channelKeyCooldown.Range(func(k, _ any) bool {
		channelKeyCooldown.Delete(k)
		return true
	})
	ch := &Channel{Id: 202, Key: "k1\nk2"}
	ch.ChannelInfo.IsMultiKey = true
	// Disable key 1; only key 0 counts. Cool key 0 -> all (enabled) cooling.
	ch.ChannelInfo.MultiKeyStatusList = map[int]int{1: common.ChannelStatusAutoDisabled}
	MarkChannelKeyCooldown(202, 0, 30)
	require.True(t, ch.EnabledKeysAllCoolingDown())
}

// TestGetRandomSatisfiedChannel_SkipsCoolingChannel verifies selection prefers a
// channel with a ready key over one whose only key is cooling down, but falls
// back when every candidate in the tier is cooling.
func TestGetRandomSatisfiedChannel_SkipsCoolingChannel(t *testing.T) {
	channelKeyCooldown.Range(func(k, _ any) bool {
		channelKeyCooldown.Delete(k)
		return true
	})
	cleanup := setupChannelCache(t, "default", "gpt-x", [][3]int{
		{1, 10, 0},
		{2, 10, 0},
	})
	defer cleanup()

	// Cool ch1's key -> selection must return ch2 every time.
	MarkChannelKeyCooldown(1, 0, 30)
	for i := 0; i < 20; i++ {
		ch, err := GetRandomSatisfiedChannel("default", "gpt-x", "", nil)
		require.NoError(t, err)
		require.NotNil(t, ch)
		require.Equal(t, 2, ch.Id)
	}

	// Cool ch2 as well -> both cooling, must fall back (never deny service).
	MarkChannelKeyCooldown(2, 0, 30)
	ch, err := GetRandomSatisfiedChannel("default", "gpt-x", "", nil)
	require.NoError(t, err)
	require.NotNil(t, ch)
}

// TestGetNextEnabledKey_SkipsCoolingKey verifies multi-key selection avoids a
// cooling key when a ready one exists.
func TestGetNextEnabledKey_SkipsCoolingKey(t *testing.T) {
	channelKeyCooldown.Range(func(k, _ any) bool {
		channelKeyCooldown.Delete(k)
		return true
	})
	ch := &Channel{Id: 300, Key: "k1\nk2"}
	ch.ChannelInfo.IsMultiKey = true
	ch.ChannelInfo.MultiKeyMode = constant.MultiKeyModeRandom

	// Cool key 0 -> every selection must land on key 1.
	MarkChannelKeyCooldown(300, 0, 30)
	for i := 0; i < 20; i++ {
		_, idx, apiErr := ch.GetNextEnabledKey()
		require.Nil(t, apiErr)
		require.Equal(t, 1, idx)
	}
}
