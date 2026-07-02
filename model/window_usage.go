package model

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/cachex"
	"github.com/samber/hot"
)

const (
	windowUsageCacheTTL = 60 * time.Second
)

var (
	windowUsageCacheOnce sync.Once
	windowUsageCache     *cachex.HybridCache[map[string]WindowUsage]
)

func getWindowUsageHybridCache() *cachex.HybridCache[map[string]WindowUsage] {
	windowUsageCacheOnce.Do(func() {
		windowUsageCache = cachex.NewHybridCache[map[string]WindowUsage](cachex.HybridCacheConfig[map[string]WindowUsage]{
			Namespace: cachex.Namespace("window_usage"),
			Redis:     common.RDB,
			RedisEnabled: func() bool {
				return common.RedisEnabled && common.RDB != nil
			},
			RedisCodec: cachex.JSONCodec[map[string]WindowUsage]{},
			Memory: func() *hot.HotCache[string, map[string]WindowUsage] {
				return hot.NewHotCache[string, map[string]WindowUsage](hot.LRU, 10000).
					WithTTL(windowUsageCacheTTL).
					WithJanitor().
					Build()
			},
		})
	})
	return windowUsageCache
}

// getWindowUsageCacheKey returns cache key for a subscription.
func getWindowUsageCacheKey(subscriptionId int) string {
	return fmt.Sprintf("sub:%d", subscriptionId)
}

// GetWindowUsageWithCache returns window usage, preferring cache over DB.
// On cache miss, queries DB and rebuilds cache.
func GetWindowUsageWithCache(subscriptionId int) (map[string]WindowUsage, error) {
	if subscriptionId <= 0 {
		return nil, errors.New("invalid subscriptionId")
	}

	key := getWindowUsageCacheKey(subscriptionId)

	// Try cache first
	if cached, found, err := getWindowUsageHybridCache().Get(key); err == nil && found {
		return cached, nil
	}

	// Cache miss: query DB
	usage, err := GetSubscriptionWindowUsage(subscriptionId)
	if err != nil {
		return nil, err
	}

	// Rebuild cache
	_ = getWindowUsageHybridCache().SetWithTTL(key, usage, windowUsageCacheTTL)

	return usage, nil
}

// InvalidateWindowUsageCache invalidates cache for a subscription.
func InvalidateWindowUsageCache(subscriptionId int) {
	key := getWindowUsageCacheKey(subscriptionId)
	_, _ = getWindowUsageHybridCache().DeleteMany([]string{key})
}

// CheckWindowLimits checks if consuming amount would exceed any window limit.
// Returns nil if OK, error if any window would be exceeded.
func CheckWindowLimits(subscriptionId int, amount int64) error {
	if amount <= 0 {
		return nil
	}

	usage, err := GetWindowUsageWithCache(subscriptionId)
	if err != nil {
		// On cache/DB error, allow consumption (fail open)
		common.SysError(fmt.Sprintf("CheckWindowLimits: failed to get window usage for sub %d: %v", subscriptionId, err))
		return nil
	}

	for window, wu := range usage {
		if wu.Limit > 0 && wu.Used+amount > wu.Limit {
			return fmt.Errorf("window %s limit exceeded: used=%d + amount=%d > limit=%d", window, wu.Used, amount, wu.Limit)
		}
	}

	return nil
}
