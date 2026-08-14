package service

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const dashboardSuccessRateCacheTTL = 30 * time.Second

type dashboardSuccessRateLoader func(context.Context, time.Time) (*float64, error)

type dashboardSuccessRateCache struct {
	mu        sync.Mutex
	expiresAt time.Time
	value     *float64
	err       error
}

func (cache *dashboardSuccessRateCache) get(
	ctx context.Context,
	now time.Time,
	loader dashboardSuccessRateLoader,
) (*float64, error) {
	cache.mu.Lock()
	defer cache.mu.Unlock()

	if now.Before(cache.expiresAt) {
		return cloneFloat64(cache.value), cache.err
	}

	value, err := loader(ctx, now)
	if err != nil && (errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)) {
		return nil, err
	}
	cache.value = cloneFloat64(value)
	cache.err = err
	cache.expiresAt = now.Add(dashboardSuccessRateCacheTTL)
	if err != nil {
		common.SysError("failed to calculate dashboard API success rate: " + err.Error())
	}
	return cloneFloat64(cache.value), cache.err
}

func cloneFloat64(value *float64) *float64 {
	if value == nil {
		return nil
	}
	clone := *value
	return &clone
}

var globalDashboardSuccessRateCache dashboardSuccessRateCache

// GetDashboardAPISuccessRate24h returns a cached global success rate. Database
// failures are returned to the dashboard handler so it can mark the node degraded.
func GetDashboardAPISuccessRate24h(ctx context.Context) (*float64, error) {
	return globalDashboardSuccessRateCache.get(ctx, time.Now(), model.GetAPISuccessRate24hWithContext)
}
