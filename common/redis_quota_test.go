package common

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func useQuotaTestRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()

	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	oldRDB, oldSyncFrequency := RDB, SyncFrequency
	RDB = client
	SyncFrequency = 60
	t.Cleanup(func() {
		require.NoError(t, client.Close())
		RDB = oldRDB
		SyncFrequency = oldSyncFrequency
	})
	return server
}

func TestRedisHDecrByIfEnoughRenewsExpiringQuotaCache(t *testing.T) {
	useQuotaTestRedis(t)
	ctx := context.Background()

	require.NoError(t, RDB.HSet(ctx, "quota:user:1", "Quota", 100).Err())
	require.NoError(t, RDB.PExpire(ctx, "quota:user:1", 500*time.Millisecond).Err())

	err := RedisHDecrByIfEnough("quota:user:1", "Quota", "", 30)
	require.NoError(t, err)

	quota, err := RDB.HGet(ctx, "quota:user:1", "Quota").Int64()
	require.NoError(t, err)
	assert.Equal(t, int64(70), quota)

	ttl, err := RDB.TTL(ctx, "quota:user:1").Result()
	require.NoError(t, err)
	assert.GreaterOrEqual(t, ttl, 59*time.Second)
}

func TestRedisHDecrByIfEnoughPreservesQuotaGuards(t *testing.T) {
	useQuotaTestRedis(t)
	ctx := context.Background()

	err := RedisHDecrByIfEnough("quota:missing", "Quota", "", 1)
	assert.ErrorIs(t, err, ErrRedisQuotaUnavailable)

	require.NoError(t, RDB.HSet(ctx, "quota:user:2", "Quota", 10).Err())
	require.NoError(t, RDB.Expire(ctx, "quota:user:2", time.Minute).Err())
	err = RedisHDecrByIfEnough("quota:user:2", "Quota", "", 11)
	assert.ErrorIs(t, err, ErrRedisQuotaInsufficient)

	quota, getErr := RDB.HGet(ctx, "quota:user:2", "Quota").Int64()
	require.NoError(t, getErr)
	assert.Equal(t, int64(10), quota)
}
