package common

import (
	"errors"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/go-redis/redis/v8"
)

var (
	channelDailyTokenFallbackMu          sync.Mutex
	channelDailyTokenFallbackUsage       = map[string]int64{}
	channelDailyTokenFallbackCleanupOnce sync.Once
	channelDailyTokenFallbackLogOnce     sync.Once
)

func channelDailyTokenDate(t time.Time) string {
	return t.Format("20060102")
}

func channelDailyTokenNextMidnight(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day()+1, 0, 0, 0, 0, t.Location())
}

func channelDailyTokenRedisKey(channelID int, t time.Time) string {
	return fmt.Sprintf(constant.ChannelDailyTokenUsageKeyFmt, channelID, channelDailyTokenDate(t))
}

func channelDailyTokenFallbackKey(channelID int, t time.Time) string {
	return fmt.Sprintf("%d:%s", channelID, channelDailyTokenDate(t))
}

func logChannelDailyTokenFallback() {
	channelDailyTokenFallbackLogOnce.Do(func() {
		SysLog("Redis is disabled; channel daily token usage falls back to in-process memory and is not consistent across multiple instances")
	})
}

func startChannelDailyTokenFallbackCleanup() {
	logChannelDailyTokenFallback()
	channelDailyTokenFallbackCleanupOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				currentDate := channelDailyTokenDate(time.Now())
				channelDailyTokenFallbackMu.Lock()
				for key := range channelDailyTokenFallbackUsage {
					if len(key) < len(currentDate) || key[len(key)-len(currentDate):] != currentDate {
						delete(channelDailyTokenFallbackUsage, key)
					}
				}
				channelDailyTokenFallbackMu.Unlock()
			}
		}()
	})
}

func GetChannelDailyTokenUsage(channelID int) int64 {
	now := time.Now()
	if RedisEnabled && RDB != nil {
		value, err := RedisGet(channelDailyTokenRedisKey(channelID, now))
		if errors.Is(err, redis.Nil) {
			return 0
		}
		if err != nil {
			SysError(fmt.Sprintf("failed to get channel daily token usage from Redis: channel_id=%d, error=%v", channelID, err))
			return 0
		}
		usage, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			SysError(fmt.Sprintf("failed to parse channel daily token usage: channel_id=%d, value=%s, error=%v", channelID, value, err))
			return 0
		}
		return usage
	}

	startChannelDailyTokenFallbackCleanup()
	key := channelDailyTokenFallbackKey(channelID, now)
	channelDailyTokenFallbackMu.Lock()
	defer channelDailyTokenFallbackMu.Unlock()
	return channelDailyTokenFallbackUsage[key]
}

func IsChannelDailyTokenUsageAvailable(channelID int, limit int64) bool {
	if limit <= 0 {
		return true
	}
	return GetChannelDailyTokenUsage(channelID) < limit
}

func IncreaseChannelDailyTokenUsage(channelID int, tokens int64) error {
	if channelID <= 0 || tokens <= 0 {
		return nil
	}

	now := time.Now()
	if RedisEnabled && RDB != nil {
		expireAt := channelDailyTokenNextMidnight(now)
		_, err := RedisIncrByWithExpireAt(channelDailyTokenRedisKey(channelID, now), tokens, expireAt)
		if err != nil {
			return fmt.Errorf("failed to increase channel daily token usage in Redis: %w", err)
		}
		return nil
	}

	startChannelDailyTokenFallbackCleanup()
	key := channelDailyTokenFallbackKey(channelID, now)
	channelDailyTokenFallbackMu.Lock()
	channelDailyTokenFallbackUsage[key] += tokens
	channelDailyTokenFallbackMu.Unlock()
	return nil
}
