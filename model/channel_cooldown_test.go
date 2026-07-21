package model

import (
	"fmt"
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

func TestChannelCooldownTracksStrictFallbackWindowSeparately(t *testing.T) {
	for _, strictFirst := range []bool{true, false} {
		t.Run(fmt.Sprintf("strict_first=%t", strictFirst), func(t *testing.T) {
			clearChannelCooldownsForTest()
			t.Cleanup(clearChannelCooldownsForTest)

			startedAt := time.Now()
			if strictFirst {
				CooldownChannelWithoutFallback(17, "stream_capacity", 15*time.Minute)
				CooldownChannel(17, "stream_unstable", time.Hour)
			} else {
				CooldownChannel(17, "stream_unstable", time.Hour)
				CooldownChannelWithoutFallback(17, "stream_capacity", 15*time.Minute)
			}

			state := getChannelCooldownState(17)
			require.True(t, state.active)
			assert.False(t, state.allowFallback)
			assert.WithinDuration(t, startedAt.Add(time.Hour), state.expires, time.Second)
			assert.WithinDuration(t, startedAt.Add(15*time.Minute), state.fallbackBlockedUntil, time.Second)
		})
	}
}

func TestExpiredStrictCooldownDoesNotBlockLongerFallbackEligibleCooldown(t *testing.T) {
	clearChannelCooldownsForTest()
	t.Cleanup(clearChannelCooldownsForTest)

	CooldownChannel(17, "stream_unstable", time.Hour)
	CooldownChannelWithoutFallback(17, "expired_capacity", -time.Second)

	state := getChannelCooldownState(17)
	require.True(t, state.active)
	assert.True(t, state.allowFallback)
}

func TestGetChannelCooldownReportsActiveStrictReason(t *testing.T) {
	clearChannelCooldownsForTest()
	t.Cleanup(clearChannelCooldownsForTest)

	startedAt := time.Now()
	CooldownChannel(17, "stream_unstable", time.Hour)
	CooldownChannelWithoutFallback(17, "stream_capacity", 15*time.Minute)

	reason, expires, cooling := GetChannelCooldown(17)
	require.True(t, cooling)
	assert.Equal(t, "stream_capacity", reason)
	assert.WithinDuration(t, startedAt.Add(15*time.Minute), time.Unix(expires, 0), time.Second)
}
