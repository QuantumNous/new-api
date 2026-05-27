package model

import (
	"testing"
	"time"
)

func TestChannelCooldownSkipsChannelUntilExpiry(t *testing.T) {
	clearChannelCooldownsForTest()

	CooldownChannel(17, "Insufficient account balance", time.Minute)

	if !IsChannelCoolingDown(17) {
		t.Fatalf("expected channel 17 to be cooling down")
	}
	if IsChannelCoolingDown(29) {
		t.Fatalf("expected channel 29 to remain available")
	}
}

func TestChannelCooldownExpires(t *testing.T) {
	clearChannelCooldownsForTest()

	CooldownChannel(17, "Insufficient account balance", -time.Second)

	if IsChannelCoolingDown(17) {
		t.Fatalf("expected expired cooldown to be cleared")
	}
}
