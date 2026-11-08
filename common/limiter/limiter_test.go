package limiter

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func useLimiterMiniRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()

	previousInstance := instance

	redisServer := miniredis.RunT(t)
	redisClient := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	require.NoError(t, redisClient.Ping(context.Background()).Err())

	instance = nil
	once = sync.Once{}

	t.Cleanup(func() {
		_ = redisClient.Close()
		instance = previousInstance
		once = sync.Once{}
		if previousInstance != nil {
			once.Do(func() {})
		}
	})

	return redisServer, redisClient
}

func TestAllowFallsBackToEvalAfterScriptFlush(t *testing.T) {
	ctx := context.Background()
	_, redisClient := useLimiterMiniRedis(t)

	redisLimiter := New(ctx, redisClient)

	allowed, err := redisLimiter.Allow(
		ctx,
		"rateLimit:test-before-flush",
		WithCapacity(60),
		WithRate(60),
		WithRequested(60),
	)
	require.NoError(t, err)
	assert.True(t, allowed)

	exists, err := redisClient.ScriptExists(ctx, redisLimiter.limitScriptSHA).Result()
	require.NoError(t, err)
	require.Len(t, exists, 1)
	assert.True(t, exists[0])

	require.NoError(t, redisClient.ScriptFlush(ctx).Err())

	exists, err = redisClient.ScriptExists(ctx, redisLimiter.limitScriptSHA).Result()
	require.NoError(t, err)
	require.Len(t, exists, 1)
	assert.False(t, exists[0])

	allowed, err = redisLimiter.Allow(
		ctx,
		"rateLimit:test-after-flush",
		WithCapacity(60),
		WithRate(60),
		WithRequested(60),
	)
	require.NoError(t, err)
	assert.True(t, allowed)

	exists, err = redisClient.ScriptExists(ctx, redisLimiter.limitScriptSHA).Result()
	require.NoError(t, err)
	require.Len(t, exists, 1)
	assert.True(t, exists[0])
}

func TestReserveSuccessSlotEnforcesSlidingWindow(t *testing.T) {
	ctx := context.Background()
	redisServer, redisClient := useLimiterMiniRedis(t)
	redisLimiter := New(ctx, redisClient)

	key := "rateLimit:success:window"
	window := time.Minute
	for i := range 3 {
		reserved, err := redisLimiter.ReserveSuccessSlot(ctx, key, 3, window, fmt.Sprintf("member-%d", i))
		require.NoError(t, err)
		require.True(t, reserved)
	}

	reserved, err := redisLimiter.ReserveSuccessSlot(ctx, key, 3, window, "member-overflow")
	require.NoError(t, err)
	assert.False(t, reserved)

	// 失败请求归还名额后，窗口内的名额可以立刻分配给下一个请求。
	require.NoError(t, redisLimiter.ReleaseSuccessSlot(ctx, key, "member-1"))
	reserved, err = redisLimiter.ReserveSuccessSlot(ctx, key, 3, window, "member-released")
	require.NoError(t, err)
	assert.True(t, reserved)

	// 旧的预留滑出窗口后，名额恢复。
	redisServer.FastForward(window + time.Second)
	reserved, err = redisLimiter.ReserveSuccessSlot(ctx, key, 3, window, "member-next-window")
	require.NoError(t, err)
	assert.True(t, reserved)
}

func TestReserveSuccessSlotConcurrentBurstCannotExceedLimit(t *testing.T) {
	ctx := context.Background()
	_, redisClient := useLimiterMiniRedis(t)
	redisLimiter := New(ctx, redisClient)

	const (
		limit     = 5
		requests  = 50
		windowKey = "rateLimit:success:burst"
	)
	var reservedCount atomic.Int32
	var wg sync.WaitGroup
	for i := range requests {
		wg.Go(func() {
			reserved, err := redisLimiter.ReserveSuccessSlot(ctx, windowKey, limit, time.Minute, fmt.Sprintf("member-%d", i))
			assert.NoError(t, err)
			if reserved {
				reservedCount.Add(1)
			}
		})
	}
	wg.Wait()

	assert.EqualValues(t, limit, reservedCount.Load())
}
