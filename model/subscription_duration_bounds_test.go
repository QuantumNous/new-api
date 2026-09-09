package model

import (
	"math"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCalcPlanEndTimeBoundsDurationsAgainstOverflow(t *testing.T) {
	start := time.Date(2026, 9, 10, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name          string
		unit          string
		value         int
		customSeconds int64
		wantEnd       int64
		wantErr       bool
	}{
		{name: "one year", unit: SubscriptionDurationYear, value: 1, wantEnd: start.AddDate(1, 0, 0).Unix()},
		{name: "twelve months", unit: SubscriptionDurationMonth, value: 12, wantEnd: start.AddDate(0, 12, 0).Unix()},
		{name: "three hundred sixty five days", unit: SubscriptionDurationDay, value: 365, wantEnd: start.Add(365 * 24 * time.Hour).Unix()},
		{name: "seven hundred twenty hours", unit: SubscriptionDurationHour, value: 720, wantEnd: start.Add(720 * time.Hour).Unix()},
		{name: "two hour custom", unit: SubscriptionDurationCustom, customSeconds: 7200, wantEnd: start.Add(2 * time.Hour).Unix()},
		{name: "overflowing years", unit: SubscriptionDurationYear, value: math.MaxInt, wantErr: true},
		{name: "overflowing months", unit: SubscriptionDurationMonth, value: math.MaxInt, wantErr: true},
		{name: "overflowing days", unit: SubscriptionDurationDay, value: math.MaxInt, wantErr: true},
		{name: "overflowing hours", unit: SubscriptionDurationHour, value: math.MaxInt, wantErr: true},
		{name: "overflowing custom seconds", unit: SubscriptionDurationCustom, customSeconds: math.MaxInt64/int64(time.Second) + 1, wantErr: true},
		{name: "nonpositive days", unit: SubscriptionDurationDay, value: 0, wantErr: true},
		{name: "unknown unit", unit: "fortnight", value: 1, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			plan := &SubscriptionPlan{
				Id:            9001,
				Title:         "Bounded Plan",
				DurationUnit:  tt.unit,
				DurationValue: tt.value,
				CustomSeconds: tt.customSeconds,
			}
			end, err := calcPlanEndTime(start, plan)
			if tt.wantErr {
				require.Error(t, err)
				require.Error(t, ValidateSubscriptionPlanDuration(plan))
				return
			}
			require.NoError(t, err)
			require.NoError(t, ValidateSubscriptionPlanDuration(plan))
			assert.Equal(t, tt.wantEnd, end)
			assert.Greater(t, end, start.Unix())
		})
	}
}

func TestValidateSubscriptionEntitlementSnapshotRejectsInvalidGroupEncoding(t *testing.T) {
	valid := SubscriptionEntitlementSnapshot{
		Version: SubscriptionEntitlementVersion1, PlanId: 9002, PlanTitle: "Group Encoding",
		DurationUnit: SubscriptionDurationMonth, DurationValue: 1,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	require.NoError(t, ValidateSubscriptionEntitlementSnapshot(valid))

	upgrade := valid
	upgrade.UpgradeGroup = string([]byte{0xff})
	require.Error(t, ValidateSubscriptionEntitlementSnapshot(upgrade))

	downgrade := valid
	downgrade.DowngradeGroup = string([]byte{0xff})
	require.Error(t, ValidateSubscriptionEntitlementSnapshot(downgrade))
}

// The bounds are derived from maxSubscriptionEntitlementSpanSeconds and the
// per-unit divisors rather than hardcoded, so changing the constant or a
// divisor moves the expectations with it instead of silently passing.
func TestSubscriptionDurationBoundsStraddleExactMaximum(t *testing.T) {
	const (
		secondsPerDay  = int64(24 * 60 * 60)
		secondsPerYear = int64(366 * 24 * 60 * 60)
	)
	start := time.Date(2026, 9, 10, 12, 0, 0, 0, time.UTC)
	maxDays := maxSubscriptionEntitlementSpanSeconds / secondsPerDay
	maxYears := maxSubscriptionEntitlementSpanSeconds / secondsPerYear

	t.Run("day at maximum is accepted", func(t *testing.T) {
		plan := &SubscriptionPlan{Id: 9003, DurationUnit: SubscriptionDurationDay, DurationValue: int(maxDays)}
		require.NoError(t, ValidateSubscriptionPlanDuration(plan))
		end, err := calcPlanEndTime(start, plan)
		require.NoError(t, err)
		assert.Greater(t, end, start.Unix())
	})
	t.Run("day one past maximum is rejected", func(t *testing.T) {
		plan := &SubscriptionPlan{Id: 9003, DurationUnit: SubscriptionDurationDay, DurationValue: int(maxDays) + 1}
		require.Error(t, ValidateSubscriptionPlanDuration(plan))
		_, err := calcPlanEndTime(start, plan)
		require.Error(t, err)
	})
	t.Run("year at maximum is accepted", func(t *testing.T) {
		plan := &SubscriptionPlan{Id: 9003, DurationUnit: SubscriptionDurationYear, DurationValue: int(maxYears)}
		require.NoError(t, ValidateSubscriptionPlanDuration(plan))
	})
	t.Run("year one past maximum is rejected", func(t *testing.T) {
		plan := &SubscriptionPlan{Id: 9003, DurationUnit: SubscriptionDurationYear, DurationValue: int(maxYears) + 1}
		require.Error(t, ValidateSubscriptionPlanDuration(plan))
	})
	t.Run("custom at maximum is accepted", func(t *testing.T) {
		plan := &SubscriptionPlan{Id: 9003, DurationUnit: SubscriptionDurationCustom, CustomSeconds: maxSubscriptionEntitlementSpanSeconds}
		require.NoError(t, ValidateSubscriptionPlanDuration(plan))
		end, err := calcPlanEndTime(start, plan)
		require.NoError(t, err)
		assert.Greater(t, end, start.Unix())
	})
	t.Run("custom one past maximum is rejected", func(t *testing.T) {
		plan := &SubscriptionPlan{Id: 9003, DurationUnit: SubscriptionDurationCustom, CustomSeconds: maxSubscriptionEntitlementSpanSeconds + 1}
		require.Error(t, ValidateSubscriptionPlanDuration(plan))
		_, err := calcPlanEndTime(start, plan)
		require.Error(t, err)
	})
}

func TestSubscriptionResetIntervalBoundsStraddleExactMaximum(t *testing.T) {
	base := time.Date(2026, 9, 10, 12, 0, 0, 0, time.UTC)
	newPlan := func(seconds int64) *SubscriptionPlan {
		return &SubscriptionPlan{
			Id: 9004, DurationUnit: SubscriptionDurationMonth, DurationValue: 1,
			QuotaResetPeriod: SubscriptionResetCustom, QuotaResetCustomSeconds: seconds,
		}
	}

	t.Run("reset interval at maximum is accepted", func(t *testing.T) {
		require.NoError(t, ValidateSubscriptionResetInterval(maxSubscriptionEntitlementSpanSeconds))
		next := calcNextResetTime(base, newPlan(maxSubscriptionEntitlementSpanSeconds), 0)
		assert.Greater(t, next, base.Unix())
	})
	t.Run("reset interval one past maximum yields no reset", func(t *testing.T) {
		require.Error(t, ValidateSubscriptionResetInterval(maxSubscriptionEntitlementSpanSeconds+1))
		// Without the bound this wraps to a negative duration and reports a reset
		// time before base, which the endUnix guard cannot detect.
		assert.Zero(t, calcNextResetTime(base, newPlan(maxSubscriptionEntitlementSpanSeconds+1), 0))
	})
	t.Run("nonpositive reset interval yields no reset", func(t *testing.T) {
		require.Error(t, ValidateSubscriptionResetInterval(0))
		assert.Zero(t, calcNextResetTime(base, newPlan(0), 0))
	})
	t.Run("realistic reset interval still schedules", func(t *testing.T) {
		require.NoError(t, ValidateSubscriptionResetInterval(30*24*60*60))
		next := calcNextResetTime(base, newPlan(30*24*60*60), 0)
		assert.Equal(t, base.Add(30*24*time.Hour).Unix(), next)
	})
	t.Run("snapshot rejects reset interval one past maximum", func(t *testing.T) {
		snapshot := SubscriptionEntitlementSnapshot{
			Version: SubscriptionEntitlementVersion1, PlanId: 9005, PlanTitle: "Reset Bound",
			DurationUnit: SubscriptionDurationMonth, DurationValue: 1,
			QuotaResetPeriod: SubscriptionResetCustom, QuotaResetCustomSeconds: maxSubscriptionEntitlementSpanSeconds,
		}
		require.NoError(t, ValidateSubscriptionEntitlementSnapshot(snapshot))
		snapshot.QuotaResetCustomSeconds = maxSubscriptionEntitlementSpanSeconds + 1
		require.Error(t, ValidateSubscriptionEntitlementSnapshot(snapshot))
	})
}
