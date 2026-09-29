package common

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/go-redis/redis/v8"
)

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

	key := CounterKey("testWindowCounter", 1, "bucket-1")
	value, err := CounterIncrBy(key, 3, time.Hour)
	require.NoError(t, err)
	assert.Equal(t, int64(3), value)
	value, err = CounterIncrBy(key, -1, time.Hour)
	require.NoError(t, err)
	assert.Equal(t, int64(2), value)
	assert.Equal(t, int64(2), CounterGet(key))
	assert.Equal(t, int64(0), CounterGet(CounterKey("testWindowCounter", 2, "bucket-1")), "unset counters read as zero")
	assert.Equal(t, int64(0), CounterGet(CounterKey("testWindowCounter", 1, "bucket-2")), "window buckets are independent counters")
}

func TestWindowCounterMIncrByAppliesAllDeltasTogether(t *testing.T) {
	useWindowCounterMemoryStore(t)

	dayKey := CounterKey("testWindowCounterBatch", 1, "20260101")
	monthKey := CounterKey("testWindowCounterBatch", 1, "202601")
	err := CounterMIncrBy([]CounterDelta{
		{Key: dayKey, Delta: 5, TTL: time.Hour},
		{Key: monthKey, Delta: 5, TTL: 2 * time.Hour},
	})
	require.NoError(t, err)
	assert.Equal(t, int64(5), CounterGet(dayKey))
	assert.Equal(t, int64(5), CounterGet(monthKey))

	err = CounterMIncrBy([]CounterDelta{
		{Key: dayKey, Delta: -2, TTL: time.Hour},
		{Key: monthKey, Delta: -2, TTL: 2 * time.Hour},
	})
	require.NoError(t, err)
	assert.Equal(t, int64(3), CounterGet(dayKey), "negative deltas (refunds) flow through batch increments")
	assert.Equal(t, int64(3), CounterGet(monthKey))

	require.NoError(t, CounterMIncrBy(nil), "an empty batch is a no-op")
}

func TestWindowCounterMemoryStoreExpiresEntries(t *testing.T) {
	useWindowCounterMemoryStore(t)

	key := CounterKey("testWindowCounterExpiry", 3, "bucket-1")
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

	first := CounterKey("testWindowCounterBatch", 1, "bucket-1")
	second := CounterKey("testWindowCounterBatch", 2, "bucket-1")
	missing := CounterKey("testWindowCounterBatch", 3, "bucket-1")
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
