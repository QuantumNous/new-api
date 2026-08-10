package setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMonthlyLimitsRoundTripThroughJSON(t *testing.T) {
	require.NoError(t, UpdateMonthlyCostLimitGroupByJSONString(`{"free":1300000,"plus":13200000,"pro":0}`))
	t.Cleanup(func() { _ = UpdateMonthlyCostLimitGroupByJSONString(`{}`) })

	require.Equal(t, int64(1300000), GetMonthlyCostLimit("free"))
	require.Equal(t, int64(13200000), GetMonthlyCostLimit("plus"))
	require.Equal(t, int64(0), GetMonthlyCostLimit("pro"), "0 means uncapped; Pro is bounded by its pool")
}

// An unknown group must not inherit someone else's ceiling.
func TestMonthlyCostLimitForAnUnknownGroupIsUncapped(t *testing.T) {
	require.NoError(t, UpdateMonthlyCostLimitGroupByJSONString(`{"free":1300000}`))
	t.Cleanup(func() { _ = UpdateMonthlyCostLimitGroupByJSONString(`{}`) })

	require.Equal(t, int64(0), GetMonthlyCostLimit("default"))
	require.Equal(t, int64(0), GetMonthlyCostLimit(""))
}

func TestMonthlyImageLimits(t *testing.T) {
	require.NoError(t, UpdateMonthlyImageLimitGroupByJSONString(`{"free":0,"plus":0,"pro":100}`))
	t.Cleanup(func() { _ = UpdateMonthlyImageLimitGroupByJSONString(`{}`) })

	limit, found := GetMonthlyImageLimit("pro")
	require.True(t, found)
	require.Equal(t, 100, limit)

	limit, found = GetMonthlyImageLimit("plus")
	require.True(t, found, "plus is explicitly configured at 0: no images allowed")
	require.Equal(t, 0, limit)
}

// A group absent from the map has no configured entitlement at all — distinct
// from a group explicitly configured at 0. The caller must be able to tell
// these apart, or an unconfigured group gets refused like a zero-entitlement one.
func TestMonthlyImageLimitForAnUnconfiguredGroupIsNotFound(t *testing.T) {
	require.NoError(t, UpdateMonthlyImageLimitGroupByJSONString(`{"pro":100}`))
	t.Cleanup(func() { _ = UpdateMonthlyImageLimitGroupByJSONString(`{}`) })

	limit, found := GetMonthlyImageLimit("free")
	require.False(t, found)
	require.Equal(t, 0, limit)
}

func TestMonthlyLimitValidationRejectsNegativesAndGarbage(t *testing.T) {
	require.Error(t, CheckMonthlyCostLimitGroup(`{"free":-1}`))
	require.Error(t, CheckMonthlyCostLimitGroup(`not json`))
	require.Error(t, CheckMonthlyImageLimitGroup(`{"pro":-5}`))
	require.NoError(t, CheckMonthlyCostLimitGroup(`{"free":0}`))
}
