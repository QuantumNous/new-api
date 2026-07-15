package service

import (
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTryAcquireConcurrency_ZeroMaxIsUnlimited(t *testing.T) {
	key := "test:unlimited"
	assert.True(t, TryAcquireConcurrency(key, 0))
	assert.True(t, TryAcquireConcurrency(key, 0))
	// no release needed; nothing tracked
}

func TestTryAcquireConcurrency_RespectsMax(t *testing.T) {
	key := "test:cap2"
	assert.True(t, TryAcquireConcurrency(key, 2))
	assert.True(t, TryAcquireConcurrency(key, 2))
	assert.False(t, TryAcquireConcurrency(key, 2), "third acquire must fail")
	ReleaseConcurrency(key)
	assert.True(t, TryAcquireConcurrency(key, 2), "acquire after release must succeed")
	ReleaseConcurrency(key)
	ReleaseConcurrency(key)
}

func TestTryAcquireConcurrency_ConcurrentInFlightNeverExceedsMax(t *testing.T) {
	const max = 5
	const goroutines = 50
	key := "test:race"
	var inFlight, peak int32
	var wg sync.WaitGroup
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 20; j++ {
				if TryAcquireConcurrency(key, max) {
					n := addInFlight(&inFlight, 1)
					recordPeak(&peak, n)
					addInFlight(&inFlight, -1)
					ReleaseConcurrency(key)
				}
			}
		}()
	}
	wg.Wait()
	assert.LessOrEqual(t, int(peak), max, "in-flight must never exceed max")
}

func addInFlight(p *int32, delta int32) int32 { return atomic.AddInt32(p, delta) }
func recordPeak(peak *int32, n int32) {
	for {
		cur := atomic.LoadInt32(peak)
		if n <= cur || atomic.CompareAndSwapInt32(peak, cur, n) {
			return
		}
	}
}
