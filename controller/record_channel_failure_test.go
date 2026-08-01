package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/types"
)

// channelErr builds a NewAPIError with an explicit status code and no
// rate-limit hint (RetryAfterSeconds == 0) — i.e. a channel-level failure.
func channelErr(status int) *types.NewAPIError {
	return types.NewErrorWithStatusCode(&stubErr{"upstream backend failure"},
		types.ErrorCode("upstream_error"), status)
}

// rateLimitErr builds a 429 NewAPIError — a per-key rate-limit signal.
func rateLimitErr() *types.NewAPIError {
	return types.NewErrorWithStatusCode(&stubErr{"rate limited"},
		types.ErrorCode("rate_limited"), http.StatusTooManyRequests)
}

// A channel-level failure (5xx, auth_unavailable, etc.) must exclude the whole
// channel on the first failure, regardless of how many keys it has, so the
// retry fails over immediately instead of burning the remaining keys against
// the same broken upstream backend.
func TestRecordChannelFailure_ChannelLevelExcludesImmediately(t *testing.T) {
	for _, status := range []int{http.StatusInternalServerError, http.StatusBadGateway, http.StatusServiceUnavailable} {
		excludeChannels := map[int]bool{}
		channelTries := map[int]int{}
		// A 4-key channel; a single channel-level error must still exclude it at once.
		recordChannelFailure(94, 4, channelErr(status), excludeChannels, channelTries)
		if !excludeChannels[94] {
			t.Fatalf("status %d: channel-level failure must exclude the whole channel on first failure", status)
		}
		if channelTries[94] != 0 {
			t.Fatalf("status %d: channel-level failure must not advance the key-rotation counter, got %d", status, channelTries[94])
		}
	}
}

// A per-key rate-limit must NOT exclude a multi-key channel until every enabled
// key has been throttled: each 429 advances the rotation counter, and only the
// attempt that exhausts the last key excludes the channel.
func TestRecordChannelFailure_RateLimitRotatesThenExcludes(t *testing.T) {
	excludeChannels := map[int]bool{}
	channelTries := map[int]int{}
	const enabledKeys = 3

	// First two throttled keys: rotate, do not exclude.
	for i := 1; i <= 2; i++ {
		recordChannelFailure(94, enabledKeys, rateLimitErr(), excludeChannels, channelTries)
		if excludeChannels[94] {
			t.Fatalf("after %d of %d keys throttled the channel must remain selectable", i, enabledKeys)
		}
		if channelTries[94] != i {
			t.Fatalf("expected channelTries=%d, got %d", i, channelTries[94])
		}
	}

	// Third throttled key exhausts the channel: now exclude.
	recordChannelFailure(94, enabledKeys, rateLimitErr(), excludeChannels, channelTries)
	if !excludeChannels[94] {
		t.Fatal("channel must be excluded once all enabled keys have been throttled")
	}
}

// A single-key channel behaves identically for both failure classes: one
// failure exhausts it, so it is excluded immediately either way.
func TestRecordChannelFailure_SingleKeyExcludesOnFirstFailure(t *testing.T) {
	// Rate-limit on a single-key channel: 1 try >= 1 key -> excluded.
	excludeChannels := map[int]bool{}
	channelTries := map[int]int{}
	recordChannelFailure(8, 1, rateLimitErr(), excludeChannels, channelTries)
	if !excludeChannels[8] {
		t.Fatal("single-key channel must be excluded on its first rate-limit failure")
	}

	// Channel-level error on a single-key channel: excluded, counter untouched.
	excludeChannels = map[int]bool{}
	channelTries = map[int]int{}
	recordChannelFailure(8, 1, channelErr(http.StatusServiceUnavailable), excludeChannels, channelTries)
	if !excludeChannels[8] {
		t.Fatal("single-key channel must be excluded on its first channel-level failure")
	}
}
