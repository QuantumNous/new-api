package limiter

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestConcurrentLimiter(t *testing.T) (*ConcurrentLimiter, *miniredis.Miniredis) {
	t.Helper()

	redisServer := miniredis.RunT(t)
	redisClient := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	require.NoError(t, redisClient.Ping(context.Background()).Err())
	t.Cleanup(func() { _ = redisClient.Close() })

	return &ConcurrentLimiter{
		client: redisClient,
		script: redis.NewScript(concurrentLimitScript),
	}, redisServer
}

func TestRedisConcurrentLimiter_AcquireRelease(t *testing.T) {
	cl, _ := newTestConcurrentLimiter(t)
	ctx := context.Background()
	const leaseTTL = 5 * time.Minute

	lease1, allowed, err := cl.Acquire(ctx, "user1", 2, leaseTTL)
	require.NoError(t, err)
	require.True(t, allowed)

	lease2, allowed, err := cl.Acquire(ctx, "user1", 2, leaseTTL)
	require.NoError(t, err)
	require.True(t, allowed)

	_, allowed, err = cl.Acquire(ctx, "user1", 2, leaseTTL)
	require.NoError(t, err)
	assert.False(t, allowed, "third acquire must be rejected at max=2")

	cl.Release(ctx, "user1", lease1)

	_, allowed, err = cl.Acquire(ctx, "user1", 2, leaseTTL)
	require.NoError(t, err)
	assert.True(t, allowed, "released slot must be reusable")
	assert.NotEqual(t, lease1, lease2, "each acquire must own a distinct lease")
}

func TestRedisConcurrentLimiter_ExpiredLeaseRecoversAndStaleReleaseIsNoop(t *testing.T) {
	cl, redisServer := newTestConcurrentLimiter(t)
	ctx := context.Background()
	const leaseTTL = 5 * time.Minute

	base := time.Now().UTC().Truncate(time.Second)
	redisServer.SetTime(base)

	staleLease, allowed, err := cl.Acquire(ctx, "user1", 1, leaseTTL)
	require.NoError(t, err)
	require.True(t, allowed)

	// 模拟持有方在 lease TTL 内未续租（如进程崩溃）
	redisServer.SetTime(base.Add(leaseTTL + time.Second))

	freshLease, allowed, err := cl.Acquire(ctx, "user1", 1, leaseTTL)
	require.NoError(t, err)
	require.True(t, allowed, "expired lease must be reclaimed automatically")

	// 超时请求结束后释放旧 lease ID：不得影响重建后的计数
	cl.Release(ctx, "user1", staleLease)

	_, allowed, err = cl.Acquire(ctx, "user1", 1, leaseTTL)
	require.NoError(t, err)
	assert.False(t, allowed, "stale release must not decrement the recreated counter")

	cl.Release(ctx, "user1", freshLease)
	_, allowed, err = cl.Acquire(ctx, "user1", 1, leaseTTL)
	require.NoError(t, err)
	assert.True(t, allowed, "valid release must free the slot")
}

func TestRedisConcurrentLimiter_RenewKeepsLongRequestCounted(t *testing.T) {
	cl, redisServer := newTestConcurrentLimiter(t)
	ctx := context.Background()
	const leaseTTL = 5 * time.Minute

	base := time.Now().UTC().Truncate(time.Second)
	redisServer.SetTime(base)

	lease, allowed, err := cl.Acquire(ctx, "user1", 1, leaseTTL)
	require.NoError(t, err)
	require.True(t, allowed)

	// 请求进行中续租一次（KeepAlive 的周期性续租使用同一 renew 操作）
	redisServer.SetTime(base.Add(200 * time.Second))
	result, err := cl.script.Run(ctx, cl.client, []string{"user1"}, "renew", int(leaseTTL.Seconds()), lease).Int()
	require.NoError(t, err)
	require.Equal(t, 1, result)

	// 越过原始过期时间（base+300s）后，lease 仍占用槽位
	redisServer.SetTime(base.Add(400 * time.Second))
	_, allowed, err = cl.Acquire(ctx, "user1", 1, leaseTTL)
	require.NoError(t, err)
	assert.False(t, allowed, "renewed lease must keep the slot occupied past original TTL")

	// release 仍能正常释放
	cl.Release(ctx, "user1", lease)
	_, allowed, err = cl.Acquire(ctx, "user1", 1, leaseTTL)
	require.NoError(t, err)
	assert.True(t, allowed)
}

func TestRedisConcurrentLimiter_Unlimited(t *testing.T) {
	cl, _ := newTestConcurrentLimiter(t)
	ctx := context.Background()

	lease, allowed, err := cl.Acquire(ctx, "user1", 0, 5*time.Minute)
	require.NoError(t, err)
	require.True(t, allowed)
	assert.Empty(t, lease, "no lease is issued when unlimited")
}
