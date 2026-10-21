package service

import (
	"context"
	"slices"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/samber/hot"
	"golang.org/x/sync/singleflight"
)

var cacheHitRates = hot.NewHotCache[string, *float64](hot.LRU, 1024).
	WithTTL(time.Minute).Build()
var cacheHitRateQueries singleflight.Group

// GetCacheHitRate shares a bounded, one-minute cache between both model tabs.
// Every visibility dimension is part of the key, including the current user.
func GetCacheHitRate(ctx context.Context, filter model.CacheUsageFilter) (*float64, error) {
	filter.AllowedGroups = slices.Clone(filter.AllowedGroups)
	slices.Sort(filter.AllowedGroups)
	// Match the UI's one-minute freshness while making requests in the same
	// minute share a query rather than scanning the log database repeatedly.
	filter.StartTimestamp -= filter.StartTimestamp % 60
	filter.EndTimestamp -= filter.EndTimestamp % 60
	key, err := common.Marshal(filter)
	if err != nil {
		return nil, err
	}
	cacheKey := string(key)
	if value, found, err := cacheHitRates.Get(cacheKey); err == nil && found {
		return value, nil
	}
	result := cacheHitRateQueries.DoChan(cacheKey, func() (any, error) {
		if value, found, err := cacheHitRates.Get(cacheKey); err == nil && found {
			return value, nil
		}
		queryCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 30*time.Second)
		defer cancel()
		value, err := model.GetCacheHitRate(queryCtx, filter)
		if err == nil {
			cacheHitRates.Set(cacheKey, value)
		}
		return value, err
	})
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case value := <-result:
		if value.Err != nil {
			return nil, value.Err
		}
		return value.Val.(*float64), nil
	}
}
