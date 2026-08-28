package service

import (
	"net/http"
	"testing"
	"time"
)

func TestCircuitBreaker_BasicFlow(t *testing.T) {
	cb := NewCircuitBreaker(3, 100*time.Millisecond, 1*time.Second)

	channelID := 101

	// Initial state: available
	if !cb.IsAvailable(channelID) {
		t.Fatalf("channel %d should be available initially", channelID)
	}

	// 1st failure (500)
	cb.RecordFailure(channelID, http.StatusInternalServerError)
	if !cb.IsAvailable(channelID) {
		t.Fatalf("channel %d should still be available after 1 failure (threshold=3)", channelID)
	}

	// 2nd failure (500)
	cb.RecordFailure(channelID, http.StatusInternalServerError)
	if !cb.IsAvailable(channelID) {
		t.Fatalf("channel %d should still be available after 2 failures", channelID)
	}

	// 3rd failure (500) -> should trigger cooldown
	cb.RecordFailure(channelID, http.StatusInternalServerError)
	if cb.IsAvailable(channelID) {
		t.Fatalf("channel %d should be in cooldown after 3 consecutive failures", channelID)
	}

	// Wait for cooldown to expire (100ms)
	time.Sleep(120 * time.Millisecond)

	// Now should be available (entering Half-Open probing)
	if !cb.IsAvailable(channelID) {
		t.Fatalf("channel %d should be available for probing after cooldown expires", channelID)
	}

	// Success probe -> recovers
	cb.RecordSuccess(channelID)
	if !cb.IsAvailable(channelID) {
		t.Fatalf("channel %d should be healthy after successful probe", channelID)
	}
}

func TestCircuitBreaker_Immediate429Cooldown(t *testing.T) {
	cb := NewCircuitBreaker(3, 100*time.Millisecond, 1*time.Second)
	channelID := 202

	// 429 Too Many Requests should immediately trigger cooldown even with 1 failure
	cb.RecordFailure(channelID, http.StatusTooManyRequests)
	if cb.IsAvailable(channelID) {
		t.Fatalf("channel %d should immediately enter cooldown upon 429", channelID)
	}
}

func TestCircuitBreaker_FilterAvailableChannels(t *testing.T) {
	cb := NewCircuitBreaker(3, 200*time.Millisecond, 1*time.Second)

	c1, c2, c3 := 1, 2, 3
	cb.RecordFailure(c1, http.StatusTooManyRequests) // c1 in cooldown

	available := cb.FilterAvailableChannels([]int{c1, c2, c3})
	if len(available) != 2 || available[0] != c2 || available[1] != c3 {
		t.Fatalf("expected [2, 3], got %v", available)
	}

	// If all channels are in cooldown, graceful fallback returns all
	cb.RecordFailure(c2, http.StatusTooManyRequests)
	cb.RecordFailure(c3, http.StatusTooManyRequests)

	fallbackAll := cb.FilterAvailableChannels([]int{c1, c2, c3})
	if len(fallbackAll) != 3 {
		t.Fatalf("expected all 3 channels returned when all are in cooldown, got %v", fallbackAll)
	}
}
