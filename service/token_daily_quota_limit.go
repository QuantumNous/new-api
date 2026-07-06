package service

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/go-redis/redis/v8"
)

const tokenDailyQuotaKeyTTL = 48 * time.Hour

var tokenDailyQuotaMemoryStore sync.Map

type tokenDailyQuotaMemoryEntry struct {
	mu       sync.Mutex
	quota    int
	deadline time.Time
}

func reserveTokenDailyQuota(tokenID int, dailyLimit int, quota int) error {
	if tokenID <= 0 || dailyLimit <= 0 || quota <= 0 {
		return nil
	}
	if common.RedisEnabled && common.RDB != nil {
		return reserveTokenDailyQuotaWithRedis(tokenID, dailyLimit, quota)
	}
	return reserveTokenDailyQuotaInMemory(tokenID, dailyLimit, quota)
}

func releaseTokenDailyQuota(tokenID int, quota int) error {
	if tokenID <= 0 || quota <= 0 {
		return nil
	}
	if common.RedisEnabled && common.RDB != nil {
		return releaseTokenDailyQuotaWithRedis(tokenID, quota)
	}
	releaseTokenDailyQuotaInMemory(tokenID, quota)
	return nil
}

func newTokenDailyQuotaLimitError(limit int) error {
	return fmt.Errorf("该 API Key 已达到每日消费限额：今日最多可消费 %s", logger.FormatQuota(limit))
}

func currentTokenDailyQuotaKey(tokenID int) string {
	now := time.Now()
	return fmt.Sprintf("token:daily_quota:%d:%s", tokenID, now.Format("20060102"))
}

func reserveTokenDailyQuotaWithRedis(tokenID int, dailyLimit int, quota int) error {
	key := currentTokenDailyQuotaKey(tokenID)
	ctx := context.Background()
	result, err := common.RDB.Eval(ctx, `
local key = KEYS[1]
local delta = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local current = tonumber(redis.call("GET", key) or "0")
if current + delta > limit then
  return redis.error_reply("daily_quota_limit_exceeded")
end
current = redis.call("INCRBY", key, delta)
if redis.call("TTL", key) < 0 then
  redis.call("EXPIRE", key, ttl)
end
return current
`, []string{key}, quota, dailyLimit, int(tokenDailyQuotaKeyTTL.Seconds())).Result()
	if err == nil {
		_ = result
		return nil
	}
	if strings.Contains(err.Error(), "daily_quota_limit_exceeded") {
		return newTokenDailyQuotaLimitError(dailyLimit)
	}
	return err
}

func releaseTokenDailyQuotaWithRedis(tokenID int, quota int) error {
	key := currentTokenDailyQuotaKey(tokenID)
	ctx := context.Background()
	_, err := common.RDB.Eval(ctx, `
local key = KEYS[1]
local delta = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local current = tonumber(redis.call("GET", key) or "0")
local next = current - delta
if next <= 0 then
  redis.call("DEL", key)
  return 0
end
redis.call("SET", key, next)
if ttl > 0 then
  redis.call("EXPIRE", key, ttl)
end
return next
`, []string{key}, quota, int(tokenDailyQuotaKeyTTL.Seconds())).Result()
	if err != nil && err != redis.Nil {
		return err
	}
	return nil
}

func reserveTokenDailyQuotaInMemory(tokenID int, dailyLimit int, quota int) error {
	key := currentTokenDailyQuotaKey(tokenID)
	now := time.Now()
	deadline := now.Add(tokenDailyQuotaKeyTTL)

	entryAny, _ := tokenDailyQuotaMemoryStore.LoadOrStore(key, &tokenDailyQuotaMemoryEntry{
		quota:    0,
		deadline: deadline,
	})
	entry := entryAny.(*tokenDailyQuotaMemoryEntry)
	entry.mu.Lock()
	defer entry.mu.Unlock()

	if now.After(entry.deadline) {
		entry.quota = 0
		entry.deadline = deadline
	}
	if entry.quota+quota > dailyLimit {
		return newTokenDailyQuotaLimitError(dailyLimit)
	}
	entry.quota += quota
	entry.deadline = deadline
	return nil
}

func releaseTokenDailyQuotaInMemory(tokenID int, quota int) {
	key := currentTokenDailyQuotaKey(tokenID)
	entryAny, ok := tokenDailyQuotaMemoryStore.Load(key)
	if !ok {
		return
	}
	entry := entryAny.(*tokenDailyQuotaMemoryEntry)
	entry.mu.Lock()
	defer entry.mu.Unlock()
	entry.quota -= quota
	if entry.quota <= 0 {
		tokenDailyQuotaMemoryStore.Delete(key)
	}
}

func settleTokenDailyQuotaDelta(tokenID int, dailyLimit int, delta int) error {
	if tokenID <= 0 || dailyLimit <= 0 || delta == 0 {
		return nil
	}
	if delta > 0 {
		return reserveTokenDailyQuota(tokenID, dailyLimit, delta)
	}
	return releaseTokenDailyQuota(tokenID, -delta)
}

func resolveTokenDailyQuotaLimit(tokenID int, currentLimit int) int {
	if tokenID <= 0 {
		return 0
	}
	if currentLimit > 0 {
		return currentLimit
	}
	token, err := model.GetTokenById(tokenID)
	if err != nil {
		return 0
	}
	return token.DailyQuotaLimit
}
