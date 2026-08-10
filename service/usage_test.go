package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestSumIncludedPoolsSingleSubscription(t *testing.T) {
	total, used, resetAt := SumIncludedPools([]model.UserSubscription{
		{AmountTotal: 20640000, AmountUsed: 5160000, NextResetTime: 1788000000},
	})

	require.Equal(t, int64(20640000), total)
	require.Equal(t, int64(5160000), used)
	require.Equal(t, int64(1788000000), resetAt)
}

// Pre-consume walks every active subscription in end_time order and spends
// from the first with room, so what the user can actually spend is the sum.
func TestSumIncludedPoolsAddsUpActiveSubscriptions(t *testing.T) {
	total, used, resetAt := SumIncludedPools([]model.UserSubscription{
		{AmountTotal: 20640000, AmountUsed: 20640000, NextResetTime: 1788000000},
		{AmountTotal: 4000000, AmountUsed: 1000000, NextResetTime: 1787000000},
	})

	require.Equal(t, int64(24640000), total)
	require.Equal(t, int64(21640000), used)
	require.Equal(t, int64(1787000000), resetAt, "the soonest reset is the one worth showing")
}

// AmountTotal 0 means unmetered in the pre-consume path, not exhausted.
func TestSumIncludedPoolsIgnoresUnmeteredSubscriptions(t *testing.T) {
	total, used, resetAt := SumIncludedPools([]model.UserSubscription{
		{AmountTotal: 0, AmountUsed: 0, NextResetTime: 1788000000},
	})

	require.Equal(t, int64(0), total)
	require.Equal(t, int64(0), used)
	require.Equal(t, int64(0), resetAt, "no pool means no reset to advertise")
}

func TestSumIncludedPoolsSkipsUnsetResetTimes(t *testing.T) {
	_, _, resetAt := SumIncludedPools([]model.UserSubscription{
		{AmountTotal: 1000, AmountUsed: 0, NextResetTime: 0},
		{AmountTotal: 1000, AmountUsed: 0, NextResetTime: 1788000000},
	})

	require.Equal(t, int64(1788000000), resetAt, "0 means never resets, not resets at the epoch")
}

func TestSumIncludedPoolsEmpty(t *testing.T) {
	total, used, resetAt := SumIncludedPools(nil)

	require.Equal(t, int64(0), total)
	require.Equal(t, int64(0), used)
	require.Equal(t, int64(0), resetAt)
}
