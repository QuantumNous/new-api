package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDashboardSuccessRateCacheCachesValuesAndErrorsForThirtySeconds(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	cache := dashboardSuccessRateCache{}
	calls := 0
	loader := func(context.Context, time.Time) (*float64, error) {
		calls++
		value := 99.7
		return &value, nil
	}

	first, err := cache.get(context.Background(), now, loader)
	require.NoError(t, err)
	require.NotNil(t, first)
	*first = 0
	second, err := cache.get(context.Background(), now.Add(29*time.Second), loader)
	require.NoError(t, err)
	require.NotNil(t, second)
	assert.InDelta(t, 99.7, *second, 0.001)
	assert.Equal(t, 1, calls)

	_, err = cache.get(context.Background(), now.Add(30*time.Second), loader)
	require.NoError(t, err)
	assert.Equal(t, 2, calls)

	failingCache := dashboardSuccessRateCache{}
	failingCalls := 0
	failure := errors.New("log database unavailable")
	failingLoader := func(context.Context, time.Time) (*float64, error) {
		failingCalls++
		return nil, failure
	}
	_, err = failingCache.get(context.Background(), now, failingLoader)
	require.ErrorIs(t, err, failure)
	_, err = failingCache.get(context.Background(), now.Add(time.Second), failingLoader)
	require.ErrorIs(t, err, failure)
	assert.Equal(t, 1, failingCalls)
}

func TestDashboardSuccessRateCacheDoesNotCacheCanceledQueries(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	cache := dashboardSuccessRateCache{}
	calls := 0
	loader := func(context.Context, time.Time) (*float64, error) {
		calls++
		if calls == 1 {
			return nil, context.Canceled
		}
		value := 100.0
		return &value, nil
	}

	_, err := cache.get(context.Background(), now, loader)
	require.ErrorIs(t, err, context.Canceled)
	value, err := cache.get(context.Background(), now.Add(time.Second), loader)
	require.NoError(t, err)
	require.NotNil(t, value)
	assert.InDelta(t, 100, *value, 0.001)
	assert.Equal(t, 2, calls)
}
