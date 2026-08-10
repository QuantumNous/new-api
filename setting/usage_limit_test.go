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

	require.Equal(t, 100, GetMonthlyImageLimit("pro"))
	require.Equal(t, 0, GetMonthlyImageLimit("plus"), "0 means no images allowed")
}

func TestMonthlyLimitValidationRejectsNegativesAndGarbage(t *testing.T) {
	require.Error(t, CheckMonthlyCostLimitGroup(`{"free":-1}`))
	require.Error(t, CheckMonthlyCostLimitGroup(`not json`))
	require.Error(t, CheckMonthlyImageLimitGroup(`{"pro":-5}`))
	require.NoError(t, CheckMonthlyCostLimitGroup(`{"free":0}`))
}
