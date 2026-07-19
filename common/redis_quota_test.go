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

func TestRedisHIncrByRenewsExpiringCompleteCache(t *testing.T) {
	useQuotaTestRedis(t)
	ctx := context.Background()

	require.NoError(t, RDB.HSet(ctx, "quota:user:3", "Id", 3, "Quota", 100).Err())
	require.NoError(t, RDB.PExpire(ctx, "quota:user:3", 500*time.Millisecond).Err())

	require.NoError(t, RedisHIncrBy("quota:user:3", "Quota", 20))
	assert.Equal(t, "120", RDB.HGet(ctx, "quota:user:3", "Quota").Val())

	ttl, err := RDB.TTL(ctx, "quota:user:3").Result()
	require.NoError(t, err)
	assert.GreaterOrEqual(t, ttl, 59*time.Second)
}

func TestRedisHIncrByRejectsMissingOrIncompleteCache(t *testing.T) {
	useQuotaTestRedis(t)
	ctx := context.Background()

	err := RedisHIncrBy("quota:missing", "Quota", 20)
	assert.ErrorIs(t, err, ErrRedisQuotaUnavailable)
	assert.Zero(t, RDB.Exists(ctx, "quota:missing").Val())

	require.NoError(t, RDB.HSet(ctx, "quota:partial", "Quota", 100).Err())
	err = RedisHIncrBy("quota:partial", "Quota", 20)
	assert.ErrorIs(t, err, ErrRedisQuotaUnavailable)
	assert.Equal(t, "100", RDB.HGet(ctx, "quota:partial", "Quota").Val())
}

func TestRedisQuotaMutationsAreIdempotentPerOperation(t *testing.T) {
	useQuotaTestRedis(t)
	ctx := context.Background()
	require.NoError(t, RDB.HSet(ctx, "quota:user:4", "Id", 4, "Quota", 100).Err())
	require.NoError(t, RDB.Expire(ctx, "quota:user:4", time.Minute).Err())

	require.NoError(t, redisHIncrByWithOperationID("quota:user:4", "Quota", 20, "credit-op"))
	require.NoError(t, redisHIncrByWithOperationID("quota:user:4", "Quota", 20, "credit-op"))
	assert.Equal(t, "120", RDB.HGet(ctx, "quota:user:4", "Quota").Val())

}

func TestRedisQuotaMutationsNeverShortenLongOrPersistentTTL(t *testing.T) {
	useQuotaTestRedis(t)
	ctx := context.Background()

	require.NoError(t, RDB.HSet(ctx, "quota:pinned", "Id", 5, "Quota", 100).Err())
	require.NoError(t, RDB.Expire(ctx, "quota:pinned", 7*24*time.Hour).Err())
	require.NoError(t, RedisHIncrBy("quota:pinned", "Quota", -10))
	pinnedTTL, err := RDB.TTL(ctx, "quota:pinned").Result()
	require.NoError(t, err)
	assert.GreaterOrEqual(t, pinnedTTL, 6*24*time.Hour)

	require.NoError(t, RDB.HSet(ctx, "quota:persistent", "Id", 6, "Quota", 100).Err())
	require.NoError(t, RedisHIncrBy("quota:persistent", "Quota", -10))
	assert.Equal(t, time.Duration(-1), RDB.TTL(ctx, "quota:persistent").Val())
}

func TestRedisHSetObjNeverShortensExistingTTL(t *testing.T) {
	useQuotaTestRedis(t)
	ctx := context.Background()
	type cacheObject struct {
		Id    int
		Quota int
	}

	require.NoError(t, RedisHSetObj("cache:new", &cacheObject{Id: 1, Quota: 10}, time.Minute))
	newTTL, err := RDB.TTL(ctx, "cache:new").Result()
	require.NoError(t, err)
	assert.GreaterOrEqual(t, newTTL, 59*time.Second)

	require.NoError(t, RDB.HSet(ctx, "cache:pinned", "Id", 2, "Quota", 20).Err())
	require.NoError(t, RDB.Expire(ctx, "cache:pinned", 7*24*time.Hour).Err())
	require.NoError(t, RedisHSetObj("cache:pinned", &cacheObject{Id: 2, Quota: 30}, time.Minute))
	pinnedTTL, err := RDB.TTL(ctx, "cache:pinned").Result()
	require.NoError(t, err)
	assert.GreaterOrEqual(t, pinnedTTL, 6*24*time.Hour)
	assert.Equal(t, "30", RDB.HGet(ctx, "cache:pinned", "Quota").Val())

	require.NoError(t, RDB.HSet(ctx, "cache:persistent", "Id", 3, "Quota", 40).Err())
	require.NoError(t, RedisHSetObj("cache:persistent", &cacheObject{Id: 3, Quota: 50}, time.Minute))
	assert.Equal(t, time.Duration(-1), RDB.TTL(ctx, "cache:persistent").Val())
}

func TestRedisQuotaMutationRejectsInvalidOperationInputs(t *testing.T) {
	useQuotaTestRedis(t)

	assert.Error(t, redisHIncrByWithOperationID("quota:user:8", "Quota", 1, ""))
}

func TestRedisHashGenerationRejectsStaleSnapshotWhilePinned(t *testing.T) {
	useQuotaTestRedis(t)
	ctx := context.Background()
	type quotaCache struct {
		Id     int
		Quota  int
		Status int
	}

	const (
		cacheKey        = "user:9"
		pinsKey         = "billing:pins:user:9"
		invalidationKey = "billing:invalidate:user:9"
		generationKey   = "billing:generation:user:9"
	)
	require.NoError(t, RedisHSetObj(cacheKey, &quotaCache{Id: 9, Quota: 100, Status: 1}, time.Minute))
	require.NoError(t, RDB.SAdd(ctx, pinsKey, "task-1").Err())

	generation, err := RedisHInvalidateWithGeneration(
		cacheKey,
		pinsKey,
		invalidationKey,
		generationKey,
		7*24*time.Hour,
		nil,
	)
	require.NoError(t, err)
	assert.Equal(t, int64(1), generation)
	assert.Equal(t, "100", RDB.HGet(ctx, cacheKey, "Quota").Val())
	assert.Equal(t, "1", RDB.HGet(ctx, cacheKey, "Status").Val())
	assert.Equal(t, int64(1), RDB.Exists(ctx, invalidationKey).Val())

	var invalidated quotaCache
	assert.ErrorIs(t, RedisHGetObjIfValid(cacheKey, invalidationKey, &invalidated), ErrRedisHashInvalidated)

	populated, err := RedisHSetObjIfGeneration(
		cacheKey,
		pinsKey,
		invalidationKey,
		generationKey,
		0,
		&quotaCache{Id: 9, Quota: 70, Status: 1},
		time.Minute,
	)
	require.NoError(t, err)
	assert.False(t, populated)
	assert.Equal(t, "100", RDB.HGet(ctx, cacheKey, "Quota").Val())
}

func TestRedisHashGenerationAllowsCurrentSnapshotAfterInvalidation(t *testing.T) {
	useQuotaTestRedis(t)
	ctx := context.Background()
	type quotaCache struct {
		Id     int
		Quota  int
		Status int
	}

	const (
		cacheKey        = "user:10"
		pinsKey         = "billing:pins:user:10"
		invalidationKey = "billing:invalidate:user:10"
		generationKey   = "billing:generation:user:10"
	)
	require.NoError(t, RedisHSetObj(cacheKey, &quotaCache{Id: 10, Quota: 100, Status: 1}, time.Minute))

	generation, err := RedisHInvalidateWithGeneration(
		cacheKey,
		pinsKey,
		invalidationKey,
		generationKey,
		7*24*time.Hour,
		nil,
	)
	require.NoError(t, err)
	assert.Zero(t, RDB.Exists(ctx, cacheKey).Val())

	populated, err := RedisHSetObjIfGeneration(
		cacheKey,
		pinsKey,
		invalidationKey,
		generationKey,
		generation,
		&quotaCache{Id: 10, Quota: 70, Status: 1},
		time.Minute,
	)
	require.NoError(t, err)
	assert.True(t, populated)

	var cached quotaCache
	require.NoError(t, RedisHGetObjIfValid(cacheKey, invalidationKey, &cached))
	assert.Equal(t, 70, cached.Quota)
}

func TestRedisPinnedHashAppliesCommittedQuotaDeltaBeforeInvalidation(t *testing.T) {
	useQuotaTestRedis(t)
	ctx := context.Background()
	type quotaCache struct {
		Id    int
		Quota int
	}

	const (
		cacheKey        = "user:11"
		pinsKey         = "billing:pins:user:11"
		invalidationKey = "billing:invalidate:user:11"
		generationKey   = "billing:generation:user:11"
	)
	require.NoError(t, RedisHSetObj(cacheKey, &quotaCache{Id: 11, Quota: 20}, time.Minute))
	require.NoError(t, RDB.SAdd(ctx, pinsKey, "task-1").Err())

	_, err := RedisHApplyDeltaAndInvalidateWithGeneration(
		cacheKey,
		pinsKey,
		invalidationKey,
		generationKey,
		7*24*time.Hour,
		"Quota",
		100,
	)
	require.NoError(t, err)
	assert.Equal(t, "120", RDB.HGet(ctx, cacheKey, "Quota").Val())
	assert.Equal(t, int64(1), RDB.Exists(ctx, invalidationKey).Val())
}

func TestRedisPinnedHashRejectsDeltaWhenQuotaSnapshotIsIncomplete(t *testing.T) {
	useQuotaTestRedis(t)
	ctx := context.Background()

	const (
		cacheKey        = "user:12"
		pinsKey         = "billing:pins:user:12"
		invalidationKey = "billing:invalidate:user:12"
		generationKey   = "billing:generation:user:12"
	)
	require.NoError(t, RDB.HSet(ctx, cacheKey, "Id", 12).Err())
	require.NoError(t, RDB.SAdd(ctx, pinsKey, "task-1").Err())

	_, err := RedisHApplyDeltaAndInvalidateWithGeneration(
		cacheKey,
		pinsKey,
		invalidationKey,
		generationKey,
		7*24*time.Hour,
		"Quota",
		100,
	)
	assert.ErrorIs(t, err, ErrRedisQuotaUnavailable)
	assert.Equal(t, int64(1), RDB.Exists(ctx, invalidationKey).Val())
	assert.False(t, RDB.HExists(ctx, cacheKey, "Quota").Val())
}
