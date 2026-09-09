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
