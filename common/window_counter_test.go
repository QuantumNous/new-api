package common

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/go-redis/redis/v8"
)

// windowCounterTestBucket returns a bucket label unique to this process run,
// so a second run of the test binary (go test -count=2) never observes
// still-live in-memory entries left by the previous run.
var windowCounterTestBucketSeq atomic.Int64

func windowCounterTestBucket(name string) string {
	return fmt.Sprintf("%s-%d", name, windowCounterTestBucketSeq.Add(1))
}

func useWindowCounterMiniRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	previousRedisEnabled := RedisEnabled
	previousRedisClient := RDB
	redisServer := miniredis.RunT(t)
	redisClient := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	require.NoError(t, redisClient.Ping(context.Background()).Err())
	RedisEnabled = true
	RDB = redisClient
	t.Cleanup(func() {
		_ = redisClient.Close()
		RedisEnabled = previousRedisEnabled
		RDB = previousRedisClient
	})
	return redisServer
}

func useWindowCounterMemoryStore(t *testing.T) {
	t.Helper()
	previousRedisEnabled := RedisEnabled
	previousRedisClient := RDB
	RedisEnabled = false
	RDB = nil
	t.Cleanup(func() {
		RedisEnabled = previousRedisEnabled
		RDB = previousRedisClient
	})
}

func TestWindowCounterIncrByAndGetMemoryStore(t *testing.T) {
	useWindowCounterMemoryStore(t)

	key := CounterKey("testWindowCounter", 1, windowCounterTestBucket("run"))
	value, err := CounterIncrBy(key, 3, time.Hour)
	require.NoError(t, err)
	assert.Equal(t, int64(3), value)
	value, err = CounterIncrBy(key, -1, time.Hour)
	require.NoError(t, err)
	assert.Equal(t, int64(2), value)
	assert.Equal(t, int64(2), CounterGet(key))
	assert.Equal(t, int64(0), CounterGet(CounterKey("testWindowCounter", 2, windowCounterTestBucket("unset"))), "unset counters read as zero")
	assert.Equal(t, int64(0), CounterGet(CounterKey("testWindowCounter", 1, windowCounterTestBucket("other"))), "window buckets are independent counters")
}

func TestWindowCounterQuotaMIncrByAppliesDeltasTogether(t *testing.T) {
	useWindowCounterMemoryStore(t)

	dayKey := CounterKey("testWindowCounterQuotaBatch", 1, windowCounterTestBucket("day"))
	monthKey := CounterKey("testWindowCounterQuotaBatch", 1, windowCounterTestBucket("month"))
	err := CounterQuotaMIncrBy([]CounterDelta{
		{Key: dayKey, Delta: 5, TTL: time.Hour},
		{Key: monthKey, Delta: 5, TTL: 2 * time.Hour},
	})
	require.NoError(t, err)
	assert.Equal(t, int64(5), CounterGet(dayKey))
	assert.Equal(t, int64(5), CounterGet(monthKey))

	err = CounterQuotaMIncrBy([]CounterDelta{
		{Key: dayKey, Delta: -2, TTL: time.Hour},
		{Key: monthKey, Delta: -2, TTL: 2 * time.Hour},
	})
	require.NoError(t, err)
	assert.Equal(t, int64(3), CounterGet(dayKey), "refunds roll the window back within the same window")
	assert.Equal(t, int64(3), CounterGet(monthKey))

	// A refund larger than the window's usage clamps at zero instead of
	// going negative, which would loosen the window's budget.
	err = CounterQuotaMIncrBy([]CounterDelta{
		{Key: dayKey, Delta: -10, TTL: time.Hour},
		{Key: monthKey, Delta: -10, TTL: 2 * time.Hour},
	})
	require.NoError(t, err)
	assert.Equal(t, int64(0), CounterGet(dayKey), "an over-refund clamps at zero")
	assert.Equal(t, int64(0), CounterGet(monthKey))

	require.NoError(t, CounterQuotaMIncrBy(nil), "an empty batch is a no-op")
}

func TestWindowCounterMemoryStoreExpiresEntries(t *testing.T) {
	useWindowCounterMemoryStore(t)

	key := CounterKey("testWindowCounterExpiry", 3, windowCounterTestBucket("run"))
	_, err := CounterIncrBy(key, 5, time.Hour)
	require.NoError(t, err)

	windowCounters.mutex.Lock()
	entry := windowCounters.entries[key]
	entry.expiresAt = time.Now().Add(-time.Minute)
	windowCounters.entries[key] = entry
	windowCounters.mutex.Unlock()

	assert.Equal(t, int64(0), CounterGet(key), "expired buckets must read as zero")
	value, err := CounterIncrBy(key, 2, time.Hour)
	require.NoError(t, err)
	assert.Equal(t, int64(2), value, "an increment after expiry restarts the bucket")
}

func TestWindowCounterMGetBatchesKeys(t *testing.T) {
	useWindowCounterMemoryStore(t)

	first := CounterKey("testWindowCounterBatch", 1, windowCounterTestBucket("first"))
	second := CounterKey("testWindowCounterBatch", 2, windowCounterTestBucket("second"))
	missing := CounterKey("testWindowCounterBatch", 3, windowCounterTestBucket("missing"))
	_, err := CounterIncrBy(first, 1, time.Hour)
	require.NoError(t, err)
	_, err = CounterIncrBy(second, 7, time.Hour)
	require.NoError(t, err)

	values := CounterMGet([]string{first, second, missing})
	assert.Equal(t, int64(1), values[first])
	assert.Equal(t, int64(7), values[second])
	_, ok := values[missing]
	assert.False(t, ok, "unset keys are absent and callers read them as zero")
}

func TestWindowCounterRedisBackendSetsTTLAndReadsBack(t *testing.T) {
	redisServer := useWindowCounterMiniRedis(t)

	key := CounterKey("testWindowCounterRedis", 7, "bucket-1")
	value, err := CounterIncrBy(key, 4, 2*time.Minute)
	require.NoError(t, err)
	assert.Equal(t, int64(4), value)
	assert.True(t, redisServer.TTL(key) > 0, "the first increment must arm the bucket TTL")

	values := CounterMGet([]string{key, CounterKey("testWindowCounterRedis", 8, "bucket-1")})
	assert.Equal(t, int64(4), values[key])
	_, ok := values[CounterKey("testWindowCounterRedis", 8, "bucket-1")]
	assert.False(t, ok, "unset keys are absent and callers read them as zero")

	value, err = CounterIncrBy(key, -2, 2*time.Minute)
	require.NoError(t, err)
	assert.Equal(t, int64(2), value, "refund deltas flow through the Redis counter unchanged")
	assert.Equal(t, int64(2), CounterGet(key))
}

func TestWindowCounterQuotaMIncrByRedisClampsRefundsAtZero(t *testing.T) {
	redisServer := useWindowCounterMiniRedis(t)

	dayKey := CounterKey("testWindowCounterQuotaRedis", 7, "20260101")
	monthKey := CounterKey("testWindowCounterQuotaRedis", 7, "202601")
	require.NoError(t, CounterQuotaMIncrBy([]CounterDelta{
		{Key: dayKey, Delta: 5, TTL: time.Hour},
		{Key: monthKey, Delta: 5, TTL: 2 * time.Hour},
	}))
	assert.Equal(t, int64(5), CounterGet(dayKey))
	assert.Equal(t, int64(5), CounterGet(monthKey))
	assert.True(t, redisServer.TTL(dayKey) > 0, "each key's TTL is armed in the same atomic step")
	assert.True(t, redisServer.TTL(monthKey) > 0)

	require.NoError(t, CounterQuotaMIncrBy([]CounterDelta{
		{Key: dayKey, Delta: -2, TTL: time.Hour},
		{Key: monthKey, Delta: -2, TTL: 2 * time.Hour},
	}))
	assert.Equal(t, int64(3), CounterGet(dayKey), "a same-window refund rolls the Redis window back")
	assert.Equal(t, int64(3), CounterGet(monthKey))

	// A refund larger than the window's usage clamps at zero on both windows.
	require.NoError(t, CounterQuotaMIncrBy([]CounterDelta{
		{Key: dayKey, Delta: -50, TTL: time.Hour},
		{Key: monthKey, Delta: -50, TTL: 2 * time.Hour},
	}))
	assert.Equal(t, int64(0), CounterGet(dayKey), "an over-refund never loosens the Redis window below zero")
	assert.Equal(t, int64(0), CounterGet(monthKey))
}
