package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
)

func TestChannelKeyCooldown_MarkIsClear(t *testing.T) {
	channelKeyCooldown.Range(func(k, _ any) bool {
		channelKeyCooldown.Delete(k)
		return true
	})

	if IsChannelKeyCoolingDown(100, 0) {
		t.Fatal("fresh key should not be cooling down")
	}

	MarkChannelKeyCooldown(100, 0, 30)
	if !IsChannelKeyCoolingDown(100, 0) {
		t.Fatal("key should be cooling down after Mark")
	}
	// Different key index of the same channel is independent.
	if IsChannelKeyCoolingDown(100, 1) {
		t.Fatal("unrelated key index should not be cooling down")
	}

	ClearChannelKeyCooldown(100, 0)
	if IsChannelKeyCoolingDown(100, 0) {
		t.Fatal("key should be selectable after Clear")
	}
}

func TestChannelKeyCooldown_Expiry(t *testing.T) {
	// A cooldown that already expired must read as not cooling down and be
	// cleaned up lazily.
	channelKeyCooldown.Store(channelKeyCooldownMapKey(101, 0), time.Now().Unix()-1)
	if IsChannelKeyCoolingDown(101, 0) {
		t.Fatal("expired cooldown should read as not cooling down")
	}
	if _, ok := channelKeyCooldown.Load(channelKeyCooldownMapKey(101, 0)); ok {
		t.Fatal("expired entry should be cleaned up on read")
	}
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
	if max := time.Now().Unix() + int64(MaxChannelCooldownSeconds); until > max {
		t.Fatalf("cooldown not clamped: until=%d, max=%d", until, max)
	}
}

func TestEnabledKeysAllCoolingDown_SingleKey(t *testing.T) {
	channelKeyCooldown.Range(func(k, _ any) bool {
		channelKeyCooldown.Delete(k)
		return true
	})
	ch := &Channel{Id: 200, Key: "k1"}

	if ch.EnabledKeysAllCoolingDown() {
		t.Fatal("single-key channel with no cooldown should be ready")
	}
	MarkChannelKeyCooldown(200, 0, 30)
	if !ch.EnabledKeysAllCoolingDown() {
		t.Fatal("single-key channel with its key cooling should report all-cooling")
	}
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
	if ch.EnabledKeysAllCoolingDown() {
		t.Fatal("channel with 2 ready keys should not be all-cooling")
	}
	// All three cooling -> all-cooling.
	MarkChannelKeyCooldown(201, 1, 30)
	MarkChannelKeyCooldown(201, 2, 30)
	if !ch.EnabledKeysAllCoolingDown() {
		t.Fatal("channel with every key cooling should report all-cooling")
	}
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
	if !ch.EnabledKeysAllCoolingDown() {
		t.Fatal("only enabled key is cooling -> should report all-cooling")
	}
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
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ch == nil || ch.Id != 2 {
			t.Fatalf("expected ch2 (ch1 cooling), got %v", ch)
		}
	}

	// Cool ch2 as well -> both cooling, must fall back (never deny service).
	MarkChannelKeyCooldown(2, 0, 30)
	ch, err := GetRandomSatisfiedChannel("default", "gpt-x", "", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ch == nil {
		t.Fatal("expected a fallback channel when all cooling, got nil")
	}
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
		if apiErr != nil {
			t.Fatalf("unexpected error: %v", apiErr)
		}
		if idx != 1 {
			t.Fatalf("expected key idx 1 (idx 0 cooling), got %d", idx)
		}
	}
}
