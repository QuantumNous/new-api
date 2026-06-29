package model

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// modelQuotaUsageCacheFields is the Redis hash cache struct
type modelQuotaUsageCacheFields struct {
	QuotaUsed  int64 `json:"quota_used"`
	QuotaLimit int64 `json:"quota_limit"`
	PeriodEnd  int64 `json:"period_end"`
}

func modelQuotaUsageCacheKey(usageId int) string {
	return fmt.Sprintf("model_quota_usage:%d", usageId)
}

// CacheIncrModelQuotaUsage atomically increments quota_used in Redis
func CacheIncrModelQuotaUsage(usageId int, delta int64) {
	if !common.RedisEnabled {
		return
	}
	key := modelQuotaUsageCacheKey(usageId)
	// RedisHIncrBy only updates if the key has a TTL (existing key)
	_ = common.RedisHIncrBy(key, "QuotaUsed", delta)
}

// CacheGetModelQuotaUsage reads quota_used from Redis cache
func CacheGetModelQuotaUsage(usageId int) (used int64, limit int64, ok bool) {
	if !common.RedisEnabled {
		return 0, 0, false
	}
	key := modelQuotaUsageCacheKey(usageId)
	var fields modelQuotaUsageCacheFields
	if err := common.RedisHGetObj(key, &fields); err != nil {
		return 0, 0, false
	}
	return fields.QuotaUsed, fields.QuotaLimit, true
}

// CacheSetModelQuotaUsage initializes the Redis cache for a usage record with TTL
func CacheSetModelQuotaUsage(usageId int, quotaUsed int64, quotaLimit int64, periodEnd int64) {
	if !common.RedisEnabled {
		return
	}
	key := modelQuotaUsageCacheKey(usageId)
	ttl := time.Duration(periodEnd-time.Now().Unix()) * time.Second
	if ttl <= 0 {
		return
	}
	fields := &modelQuotaUsageCacheFields{
		QuotaUsed:  quotaUsed,
		QuotaLimit: quotaLimit,
		PeriodEnd:  periodEnd,
	}
	_ = common.RedisHSetObj(key, fields, ttl)
}

// CacheDeleteModelQuotaUsage removes the Redis cache for a usage record
func CacheDeleteModelQuotaUsage(usageId int) {
	if !common.RedisEnabled {
		return
	}
	_ = common.RedisDel(modelQuotaUsageCacheKey(usageId))
}

// cacheGetModelQuotaUsedRaw reads just the quota_used field as a string (used for debugging)
func cacheGetModelQuotaUsedRaw(usageId int) (string, error) {
	if !common.RedisEnabled {
		return "", fmt.Errorf("redis not enabled")
	}
	key := modelQuotaUsageCacheKey(usageId)
	ctx := context.Background()
	val, err := common.RDB.HGet(ctx, key, "QuotaUsed").Result()
	if err != nil {
		return "", err
	}
	return val, nil
}

// parseInt64 helper
func parseInt64(s string) int64 {
	v, _ := strconv.ParseInt(s, 10, 64)
	return v
}
