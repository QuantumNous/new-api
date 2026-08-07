package common

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestInMemoryRateLimiterReportsRemainingWindow(t *testing.T) {
	var limiter InMemoryRateLimiter
	limiter.Init(time.Hour)

	allowed, retryAfter := limiter.RequestWithRetryAfter("tail", 1, 10)
	assert.True(t, allowed)
	assert.Zero(t, retryAfter)

	// The limiter stores whole-second timestamps. Waiting just over one second
	// places the next rejection near the end of the ten-second window without
	// making the test depend on sub-second clock precision.
	time.Sleep(1100 * time.Millisecond)
	allowed, retryAfter = limiter.RequestWithRetryAfter("tail", 1, 10)
	assert.False(t, allowed)
	assert.GreaterOrEqual(t, retryAfter, int64(1))
	assert.Less(t, retryAfter, int64(10))
}
