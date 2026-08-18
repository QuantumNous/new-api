package common

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestInMemoryRateLimiterConcurrentInit(t *testing.T) {
	var limiter InMemoryRateLimiter
	start := make(chan struct{})
	var ready sync.WaitGroup
	var done sync.WaitGroup
	ready.Add(2)
	done.Add(2)
	for range 2 {
		go func() {
			defer done.Done()
			ready.Done()
			<-start
			limiter.Init(0)
		}()
	}
	ready.Wait()
	close(start)
	done.Wait()

	assert.True(t, limiter.Request("test", 1, 60))
	assert.False(t, limiter.Request("test", 1, 60))
}

func TestInMemoryRateLimiterDisablesNonPositiveLimits(t *testing.T) {
	for _, maximum := range []int{0, -1} {
		var limiter InMemoryRateLimiter
		limiter.Init(0)

		assert.True(t, limiter.Request("request", maximum, 60))
		assert.True(t, limiter.Reserve("reservation", maximum, 60, "test-reservation"))
		assert.True(t, limiter.Check("check", maximum, 60))
	}
}
