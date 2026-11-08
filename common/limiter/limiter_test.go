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

	previousInstance := instance.Load()

	redisServer := miniredis.RunT(t)
	redisClient := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	require.NoError(t, redisClient.Ping(context.Background()).Err())

	instance.Store(nil)
	once = sync.Once{}

	t.Cleanup(func() {
		_ = redisClient.Close()
		instance.Store(previousInstance)
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

// The shared limiter is rebound whenever the Redis client changes, which can
// happen concurrently with in-flight requests. The pointer must be published
// atomically: an unsynchronized rebind races with every reader and can expose
// a limiter whose script SHAs belong to another client.
func TestNewRebindsAtomicallyUnderConcurrentCalls(t *testing.T) {
	ctx := context.Background()

	serverA := miniredis.RunT(t)
	serverB := miniredis.RunT(t)
	clientA := redis.NewClient(&redis.Options{Addr: serverA.Addr()})
	clientB := redis.NewClient(&redis.Options{Addr: serverB.Addr()})
	require.NoError(t, clientA.Ping(ctx).Err())
	require.NoError(t, clientB.Ping(ctx).Err())

	previousInstance := instance.Load()
	instance.Store(nil)
	once = sync.Once{}
	t.Cleanup(func() {
		_ = clientA.Close()
		_ = clientB.Close()
		instance.Store(previousInstance)
		once = sync.Once{}
		if previousInstance != nil {
			once.Do(func() {})
		}
	})

	const workers = 16
	var wg sync.WaitGroup
	for i := range workers {
		wg.Go(func() {
			client := clientA
			if i%2 == 1 {
				client = clientB
			}
			redisLimiter := New(ctx, client)
			if !assert.NotNil(t, redisLimiter) {
				return
			}
			assert.Same(t, client, redisLimiter.client)

			allowed, err := redisLimiter.Allow(ctx, "rateLimit:race:"+client.Options().Addr, WithCapacity(10), WithRate(10), WithRequested(1))
			assert.NoError(t, err)
			assert.True(t, allowed)
		})
	}
	wg.Wait()
}

// A rebind must produce a limiter that is usable with the new client, and the
// previously published limiter must stay intact for concurrent readers.
func TestNewRebindsToTheNewClient(t *testing.T) {
	ctx := context.Background()
	_, clientA := useLimiterMiniRedis(t)
	first := New(ctx, clientA)
	require.Same(t, clientA, first.client)

	secondServer := miniredis.RunT(t)
	clientB := redis.NewClient(&redis.Options{Addr: secondServer.Addr()})
	require.NoError(t, clientB.Ping(ctx).Err())
	t.Cleanup(func() { _ = clientB.Close() })

	second := New(ctx, clientB)
	assert.Same(t, clientB, second.client)
	assert.Same(t, clientA, first.client)

	allowed, err := second.Allow(ctx, "rateLimit:rebind", WithCapacity(1), WithRate(1), WithRequested(1))
	require.NoError(t, err)
	assert.True(t, allowed)
}
