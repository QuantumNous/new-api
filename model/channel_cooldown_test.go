package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

func TestChannelCooldownCannotBeShortenedByConcurrentFailure(t *testing.T) {
	clearChannelCooldownsForTest()
	t.Cleanup(clearChannelCooldownsForTest)

	CooldownChannel(17, "stream_capacity", 15*time.Minute)
	_, firstExpiry, cooling := GetChannelCooldown(17)
	require.True(t, cooling)

	CooldownChannel(17, "retryable_transient", 5*time.Minute)
	reason, secondExpiry, cooling := GetChannelCooldown(17)
	require.True(t, cooling)
	assert.Equal(t, firstExpiry, secondExpiry)
	assert.Equal(t, "stream_capacity", reason)
}
