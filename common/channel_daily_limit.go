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

func logChannelDailyTokenFallbackRedisDisabled() {
	channelDailyTokenFallbackLogOnce.Do(func() {
		SysLog("Redis is disabled; channel daily token usage falls back to in-process memory and is not consistent across multiple instances")
	})
}

func startChannelDailyTokenFallbackCleanup() {
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

func getChannelDailyTokenFallbackUsage(channelID int, now time.Time) int64 {
	key := channelDailyTokenFallbackKey(channelID, now)
	channelDailyTokenFallbackMu.Lock()
	defer channelDailyTokenFallbackMu.Unlock()
	return channelDailyTokenFallbackUsage[key]
}

func addChannelDailyTokenFallbackUsage(channelID int, tokens int64, now time.Time) {
	key := channelDailyTokenFallbackKey(channelID, now)
	channelDailyTokenFallbackMu.Lock()
	channelDailyTokenFallbackUsage[key] += tokens
	channelDailyTokenFallbackMu.Unlock()
}

func GetChannelDailyTokenUsage(channelID int) int64 {
	now := time.Now()
	fallbackUsage := getChannelDailyTokenFallbackUsage(channelID, now)
	if RedisEnabled && RDB != nil {
		value, err := RedisGet(channelDailyTokenRedisKey(channelID, now))
		if errors.Is(err, redis.Nil) {
			return fallbackUsage
		}
		if err != nil {
			SysError(fmt.Sprintf("failed to get channel daily token usage from Redis: channel_id=%d, error=%v", channelID, err))
			return fallbackUsage
		}
		usage, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			SysError(fmt.Sprintf("failed to parse channel daily token usage: channel_id=%d, value=%s, error=%v", channelID, value, err))
			return fallbackUsage
		}
		return usage + fallbackUsage
	}

	logChannelDailyTokenFallbackRedisDisabled()
	startChannelDailyTokenFallbackCleanup()
	return fallbackUsage
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
			startChannelDailyTokenFallbackCleanup()
			addChannelDailyTokenFallbackUsage(channelID, tokens, now)
			fallbackErr := fmt.Errorf("channel daily token usage NOT recorded in Redis, daily limit may not take effect across instances: channel_id=%d, tokens=%d, error=%w", channelID, tokens, err)
			SysError(fallbackErr.Error())
			return fallbackErr
		}
		return nil
	}

	logChannelDailyTokenFallbackRedisDisabled()
	startChannelDailyTokenFallbackCleanup()
	addChannelDailyTokenFallbackUsage(channelID, tokens, now)
	return nil
}
