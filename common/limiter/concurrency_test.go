package limiter

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInMemoryConcurrentLimiter_AcquireRelease(t *testing.T) {
	l := &InMemoryConcurrentLimiter{store: make(map[string]*int64)}

	assert.True(t, l.Acquire("user1", 3))
	assert.True(t, l.Acquire("user1", 3))
	assert.True(t, l.Acquire("user1", 3))
	assert.False(t, l.Acquire("user1", 3), "4th acquire should be rejected at max=3")

	l.Release("user1")
	assert.True(t, l.Acquire("user1", 3), "after release, acquire should succeed again")
}

func TestInMemoryConcurrentLimiter_ReleaseUnderflow(t *testing.T) {
	l := &InMemoryConcurrentLimiter{store: make(map[string]*int64)}

	l.Release("nonexistent")
	require.True(t, l.Acquire("user1", 2))
	l.Release("user1")
	l.Release("user1")
	l.Release("user1")

	assert.True(t, l.Acquire("user1", 1), "counter must not go negative; release underflow guarded")
}

func TestInMemoryConcurrentLimiter_Unlimited(t *testing.T) {
	l := &InMemoryConcurrentLimiter{store: make(map[string]*int64)}
	for i := 0; i < 100; i++ {
		assert.True(t, l.Acquire("user1", 0), "maxConcurrent=0 means unlimited")
	}
}

func TestInMemoryConcurrentLimiter_IsolationByUser(t *testing.T) {
	l := &InMemoryConcurrentLimiter{store: make(map[string]*int64)}

	require.True(t, l.Acquire("user1", 1))
	assert.False(t, l.Acquire("user1", 1), "user1 at limit")

	assert.True(t, l.Acquire("user2", 1), "user2 independent bucket")
	assert.False(t, l.Acquire("user2", 1))
}
