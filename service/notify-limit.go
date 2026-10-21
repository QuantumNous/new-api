package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/bytedance/gopkg/util/gopool"
)

// notifyLimitStore is used for in-memory rate limiting when Redis is disabled
var (
	notifyLimitStore sync.Map
	cleanupOnce      sync.Once
)

type limitCount struct {
	Count     int
	Timestamp time.Time
}

func getDuration() time.Duration {
	minute := constant.NotificationLimitDurationMinute
	return time.Duration(minute) * time.Minute
}

// startCleanupTask starts a background task to clean up expired entries
func startCleanupTask() {
	gopool.Go(func() {
		for {
			time.Sleep(time.Hour)
			now := time.Now()
			notifyLimitStore.Range(func(key, value any) bool {
				if limit, ok := value.(limitCount); ok {
					if now.Sub(limit.Timestamp) >= getDuration() {
						notifyLimitStore.Delete(key)
					}
				}
				return true
			})
		}
	})
}

// CheckNotificationLimit checks if the user has exceeded their notification limit
// Returns true if the user can send notification, false if limit exceeded
func CheckNotificationLimit(userId int, notifyType string) (bool, error) {
	if common.RedisEnabled {
		return checkRedisLimit(userId, notifyType)
	}
	return checkMemoryLimit(userId, notifyType)
}

func checkRedisLimit(userId int, notifyType string) (bool, error) {
	ctx := context.Background()
	key := fmt.Sprintf("notify_limit:%d:%s", userId, notifyType)

	// SETNX 只在窗口开始时写入过期时间，INCR 会保留原 TTL；放在同一事务里避免产生永不过期的计数
	pipe := common.RDB.TxPipeline()
	pipe.SetNX(ctx, key, 0, getDuration())
	incr := pipe.Incr(ctx, key)
	if _, err := pipe.Exec(ctx); err != nil {
		return false, fmt.Errorf("failed to increment notification count: %w", err)
	}

	count := incr.Val()
	return count <= int64(constant.NotifyLimitCount), nil
}

func checkMemoryLimit(userId int, notifyType string) (bool, error) {
	// Ensure cleanup task is started
	cleanupOnce.Do(startCleanupTask)

	key := fmt.Sprintf("%d:%s", userId, notifyType)
	now := time.Now()

	// Get current limit count or initialize new one
	var currentLimit limitCount
	if value, ok := notifyLimitStore.Load(key); ok {
		currentLimit = value.(limitCount)
		// Check if the entry has expired
		if now.Sub(currentLimit.Timestamp) >= getDuration() {
			currentLimit = limitCount{Count: 0, Timestamp: now}
		}
	} else {
		currentLimit = limitCount{Count: 0, Timestamp: now}
	}

	// Increment count
	currentLimit.Count++

	// Check against limits
	limit := constant.NotifyLimitCount

	// Store updated count
	notifyLimitStore.Store(key, currentLimit)

	return currentLimit.Count <= limit, nil
}
