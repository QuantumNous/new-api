package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestUsageCycleWithoutSubscriptionUsesTheCalendarMonth(t *testing.T) {
	now := time.Date(2026, 8, 10, 14, 30, 0, 0, time.Local)

	start, resetAt := UsageCycle(CycleMonth, nil, now)

	require.Equal(t, time.Date(2026, 8, 1, 0, 0, 0, 0, time.Local).Unix(), start)
	require.Equal(t, time.Date(2026, 9, 1, 0, 0, 0, 0, time.Local).Unix(), resetAt)
}

// An unmetered row (Plus today, total 0) is not a pool, so it must not drag the
// cycle onto a billing anniversary.
func TestUsageCycleIgnoresUnmeteredSubscriptions(t *testing.T) {
	now := time.Date(2026, 8, 10, 14, 30, 0, 0, time.Local)
	sub := &model.UserSubscription{AmountTotal: 0, StartTime: 1780000000, NextResetTime: 1788000000}

	start, resetAt := UsageCycle(CycleMonth, sub, now)

	require.Equal(t, time.Date(2026, 8, 1, 0, 0, 0, 0, time.Local).Unix(), start)
	require.Equal(t, time.Date(2026, 9, 1, 0, 0, 0, 0, time.Local).Unix(), resetAt)
}

func TestUsageCycleFollowsAMeteredSubscription(t *testing.T) {
	now := time.Date(2026, 8, 10, 14, 30, 0, 0, time.Local)
	sub := &model.UserSubscription{
		AmountTotal:   13700000,
		StartTime:     1783000000,
		LastResetTime: 1786000000,
		NextResetTime: 1788000000,
	}

	start, resetAt := UsageCycle(CycleMonth, sub, now)

	require.Equal(t, int64(1786000000), start, "the pool and the counters must share one cycle")
	require.Equal(t, int64(1788000000), resetAt)
}

// A subscription bought this cycle has never reset, so start_time is the anchor.
func TestUsageCycleFallsBackToStartTimeBeforeTheFirstReset(t *testing.T) {
	now := time.Date(2026, 8, 10, 14, 30, 0, 0, time.Local)
	sub := &model.UserSubscription{AmountTotal: 13700000, StartTime: 1786500000, NextResetTime: 1789000000}

	start, _ := UsageCycle(CycleMonth, sub, now)

	require.Equal(t, int64(1786500000), start)
}

func TestUsageCycleOnDecemberRollsIntoNextYear(t *testing.T) {
	now := time.Date(2026, 12, 20, 9, 0, 0, 0, time.Local)

	_, resetAt := UsageCycle(CycleMonth, nil, now)

	require.Equal(t, time.Date(2027, 1, 1, 0, 0, 0, 0, time.Local).Unix(), resetAt)
}
