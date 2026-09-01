package common

import (
	"sync"
	"sync/atomic"
	"testing"
)

func TestInMemoryRateLimiterReserveIsAtomicUnderConcurrency(t *testing.T) {
	limiter := InMemoryRateLimiter{}
	limiter.Init(0)

	const (
		requestCount = 50
		maximumCount = 10
		duration     = int64(60)
	)

	var allowedCount atomic.Int32
	reservations := make(chan uint64, maximumCount)
	var waitGroup sync.WaitGroup
	waitGroup.Add(requestCount)
	for range requestCount {
		go func() {
			defer waitGroup.Done()
			reservationID, allowed := limiter.Reserve("concurrent", maximumCount, duration)
			if allowed {
				allowedCount.Add(1)
				reservations <- reservationID
			}
		}()
	}
	waitGroup.Wait()
	close(reservations)

	if got := allowedCount.Load(); got != maximumCount {
		t.Fatalf("Reserve allowed %d requests, want %d", got, maximumCount)
	}
	for reservationID := range reservations {
		if !limiter.Release("concurrent", reservationID) {
			t.Fatalf("Release(%d) failed", reservationID)
		}
	}
}

func TestInMemoryRateLimiterFailedReservationCanBeReused(t *testing.T) {
	limiter := InMemoryRateLimiter{}
	limiter.Init(0)

	reservationID, allowed := limiter.Reserve("failed", 1, 60)
	if !allowed {
		t.Fatal("first reservation should be allowed")
	}
	if !limiter.Release("failed", reservationID) {
		t.Fatal("failed request reservation should be released")
	}

	reservationID, allowed = limiter.Reserve("failed", 1, 60)
	if !allowed {
		t.Fatal("released reservation should free the slot")
	}
	if !limiter.Commit("failed", reservationID, 60) {
		t.Fatal("successful reservation should be committed")
	}
	if _, allowed = limiter.Reserve("failed", 1, 60); allowed {
		t.Fatal("a committed success should consume the slot")
	}
}
