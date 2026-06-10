package model

import (
	"testing"
	"time"
)

func TestChannelQuotaCooldownLifecycle(t *testing.T) {
	const channelId = 999001

	if IsChannelInQuotaCooldown(channelId) {
		t.Fatal("channel should not be in cooldown initially")
	}

	SetChannelQuotaCooldown(channelId)
	if !IsChannelInQuotaCooldown(channelId) {
		t.Fatal("channel should be in cooldown after SetChannelQuotaCooldown")
	}

	ClearChannelQuotaCooldown(channelId)
	if IsChannelInQuotaCooldown(channelId) {
		t.Fatal("channel should not be in cooldown after ClearChannelQuotaCooldown")
	}
}

func TestChannelQuotaCooldownExpiry(t *testing.T) {
	const channelId = 999002

	channelQuotaCooldowns.Store(channelId, time.Now().Add(-time.Second))
	if IsChannelInQuotaCooldown(channelId) {
		t.Fatal("expired cooldown should be treated as not in cooldown")
	}
	if _, ok := channelQuotaCooldowns.Load(channelId); ok {
		t.Fatal("expired cooldown entry should be lazily deleted")
	}
}
