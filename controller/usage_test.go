package controller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func meterOfKind(meters []UsageMeter, kind string) *UsageMeter {
	for i := range meters {
		if meters[i].Kind == kind {
			return &meters[i]
		}
	}
	return nil
}

func TestBuildUsageMetersRequestsMeter(t *testing.T) {
	meters := BuildUsageMeters(UsageInputs{
		RateLimitEnabled: true,
		RequestLimit:     100,
		RequestsUsed:     60,
		WindowStart:      1786000000,
		WindowSeconds:    18000,
	})

	m := meterOfKind(meters, UsageMeterRequests)
	require.NotNil(t, m, "every tier is rate limited, so every tier gets a requests meter")
	require.Equal(t, int64(60), m.Used)
	require.Equal(t, int64(100), m.Limit)
	require.Equal(t, 60, m.Percent)
	require.Equal(t, int64(1786018000), m.ResetAt, "the window frees a slot one duration after its oldest entry")
}

func TestBuildUsageMetersRequestsPercentRounds(t *testing.T) {
	meters := BuildUsageMeters(UsageInputs{
		RateLimitEnabled: true,
		RequestLimit:     800,
		RequestsUsed:     3,
		WindowStart:      1786000000,
		WindowSeconds:    18000,
	})

	require.Equal(t, 0, meterOfKind(meters, UsageMeterRequests).Percent,
		"3/800 rounds down to 0% rather than showing a phantom sliver")
}

// Redis runs allkeys-lru at 128mb, so the rate-limit key can be evicted out
// from under us. A missing key means the user has spent nothing in the current
// window — it must never read as an error or as a full bar.
func TestBuildUsageMetersMissingRateLimitKeyReadsAsZero(t *testing.T) {
	meters := BuildUsageMeters(UsageInputs{
		RateLimitEnabled: true,
		RequestLimit:     100,
		RequestsUsed:     UsageRequestsUnknown,
		WindowStart:      0,
		WindowSeconds:    18000,
	})

	m := meterOfKind(meters, UsageMeterRequests)
	require.NotNil(t, m)
	require.Equal(t, int64(0), m.Used)
	require.Equal(t, 0, m.Percent)
	require.Equal(t, int64(0), m.ResetAt, "no window start means no honest reset time to show")
}

func TestBuildUsageMetersRequestsOverrunClampsAtFull(t *testing.T) {
	meters := BuildUsageMeters(UsageInputs{
		RateLimitEnabled: true,
		RequestLimit:     100,
		RequestsUsed:     140,
		WindowStart:      1786000000,
		WindowSeconds:    18000,
	})

	require.Equal(t, 100, meterOfKind(meters, UsageMeterRequests).Percent)
}

func TestBuildUsageMetersNoRequestsMeterWhenRateLimitDisabled(t *testing.T) {
	meters := BuildUsageMeters(UsageInputs{
		RateLimitEnabled: false,
		RequestLimit:     100,
		RequestsUsed:     60,
		WindowStart:      1786000000,
		WindowSeconds:    18000,
	})

	require.Nil(t, meterOfKind(meters, UsageMeterRequests),
		"nothing is being enforced, so there is nothing to meter")
}

func TestBuildUsageMetersIncludedPool(t *testing.T) {
	meters := BuildUsageMeters(UsageInputs{
		IncludedTotal:   20640000,
		IncludedUsed:    5160000,
		IncludedResetAt: 1788000000,
	})

	m := meterOfKind(meters, UsageMeterIncluded)
	require.NotNil(t, m)
	require.Equal(t, int64(5160000), m.Used)
	require.Equal(t, int64(20640000), m.Limit)
	require.Equal(t, 25, m.Percent)
	require.Equal(t, int64(1788000000), m.ResetAt, "the pool zeroes at next_reset_time")
}

// Free and Plus rows carry total_amount 0 with quota_reset_period never, so a
// pool meter would render 0/0. Gate on the data, not on the tier name.
func TestBuildUsageMetersNoIncludedMeterWithoutAPool(t *testing.T) {
	meters := BuildUsageMeters(UsageInputs{
		RateLimitEnabled: true,
		RequestLimit:     100,
		RequestsUsed:     12,
		IncludedTotal:    0,
		IncludedUsed:     0,
	})

	require.Nil(t, meterOfKind(meters, UsageMeterIncluded))
	require.NotNil(t, meterOfKind(meters, UsageMeterRequests), "Free still gets its requests meter")
}

func TestBuildUsageMetersIncludedOverrunClampsAtFull(t *testing.T) {
	meters := BuildUsageMeters(UsageInputs{
		IncludedTotal: 1000,
		IncludedUsed:  1400,
	})

	require.Equal(t, 100, meterOfKind(meters, UsageMeterIncluded).Percent,
		"an in-flight task may overrun the pool by about one task")
}

func TestBuildUsageMetersProGetsBothMetersRequestsFirst(t *testing.T) {
	meters := BuildUsageMeters(UsageInputs{
		RateLimitEnabled: true,
		RequestLimit:     2000,
		RequestsUsed:     500,
		WindowStart:      1786000000,
		WindowSeconds:    18000,
		IncludedTotal:    20640000,
		IncludedUsed:     10320000,
		IncludedResetAt:  1788000000,
	})

	require.Len(t, meters, 2)
	require.Equal(t, UsageMeterRequests, meters[0].Kind, "render order is fixed by the payload")
	require.Equal(t, UsageMeterIncluded, meters[1].Kind)
	require.Equal(t, 50, meters[1].Percent)
}

func TestBuildUsageMetersNoRequestsMeterWhenLimitIsUnlimited(t *testing.T) {
	meters := BuildUsageMeters(UsageInputs{
		RateLimitEnabled: true,
		RequestLimit:     0,
		RequestsUsed:     60,
		WindowStart:      1786000000,
		WindowSeconds:    18000,
	})

	require.Nil(t, meterOfKind(meters, UsageMeterRequests),
		"0 means unlimited in ModelRequestRateLimitGroup; a bar needs a denominator")
}

func TestBuildUsageMetersMonthlyAllowance(t *testing.T) {
	meters := BuildUsageMeters(UsageInputs{
		MonthlyCostUsed:  4_120_000,
		MonthlyCostLimit: 13_200_000,
		MonthlyResetAt:   1788000000,
	})

	m := meterOfKind(meters, UsageMeterMonthly)
	require.NotNil(t, m)
	require.Equal(t, 31, m.Percent)
	require.Equal(t, int64(1788000000), m.ResetAt)
}

func TestBuildUsageMetersNoMonthlyMeterWhenUncapped(t *testing.T) {
	meters := BuildUsageMeters(UsageInputs{MonthlyCostUsed: 999, MonthlyCostLimit: 0})

	require.Nil(t, meterOfKind(meters, UsageMeterMonthly), "0 means uncapped; Pro shows its pool instead")
}

func TestBuildUsageMetersImagesAllowance(t *testing.T) {
	meters := BuildUsageMeters(UsageInputs{ImagesUsed: 14, ImageLimit: 100, MonthlyResetAt: 1788000000})

	m := meterOfKind(meters, UsageMeterImages)
	require.NotNil(t, m)
	require.Equal(t, 14, m.Percent)
}

func TestBuildUsageMetersNoImageMeterForATierWithoutTheEntitlement(t *testing.T) {
	meters := BuildUsageMeters(UsageInputs{ImagesUsed: 0, ImageLimit: 0})

	require.Nil(t, meterOfKind(meters, UsageMeterImages))
}
