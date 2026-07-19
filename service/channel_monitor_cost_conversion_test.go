package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCalculateChannelMonitorCostRatio(t *testing.T) {
	tests := []struct {
		name       string
		config     ChannelMonitorCostConversion
		wantFactor float64
		wantRatio  float64
	}{
		{
			name:       "no conversion",
			config:     ChannelMonitorCostConversion{Mode: ChannelMonitorCostConversionNone},
			wantFactor: 1,
			wantRatio:  0.8,
		},
		{
			name: "recharge",
			config: ChannelMonitorCostConversion{
				Mode:        ChannelMonitorCostConversionRecharge,
				PaidCNY:     100,
				CreditedUSD: 200,
			},
			wantFactor: 0.5,
			wantRatio:  0.4,
		},
		{
			name: "daily subscription",
			config: ChannelMonitorCostConversion{
				Mode:                 ChannelMonitorCostConversionSubscription,
				SubscriptionPeriod:   ChannelMonitorSubscriptionPeriodDay,
				SubscriptionPriceCNY: 10,
				SubscriptionDailyUSD: 20,
			},
			wantFactor: 0.5,
			wantRatio:  0.4,
		},
		{
			name: "weekly subscription",
			config: ChannelMonitorCostConversion{
				Mode:                 ChannelMonitorCostConversionSubscription,
				SubscriptionPeriod:   ChannelMonitorSubscriptionPeriodWeek,
				SubscriptionPriceCNY: 70,
				SubscriptionDailyUSD: 20,
			},
			wantFactor: 0.5,
			wantRatio:  0.4,
		},
		{
			name: "monthly subscription uses thirty days",
			config: ChannelMonitorCostConversion{
				Mode:                 ChannelMonitorCostConversionSubscription,
				SubscriptionPeriod:   ChannelMonitorSubscriptionPeriodMonth,
				SubscriptionPriceCNY: 300,
				SubscriptionDailyUSD: 20,
			},
			wantFactor: 0.5,
			wantRatio:  0.4,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ratio, factor, err := CalculateChannelMonitorCostRatio(0.8, test.config)
			require.NoError(t, err)
			assert.InDelta(t, test.wantFactor, factor, 1e-9)
			assert.InDelta(t, test.wantRatio, ratio, 1e-9)
		})
	}
}

func TestNormalizeChannelMonitorCostConversionRejectsInvalidValues(t *testing.T) {
	tests := []ChannelMonitorCostConversion{
		{Mode: "unknown"},
		{Mode: ChannelMonitorCostConversionRecharge, PaidCNY: 0, CreditedUSD: 100},
		{Mode: ChannelMonitorCostConversionRecharge, PaidCNY: 100, CreditedUSD: 0},
		{
			Mode:                 ChannelMonitorCostConversionSubscription,
			SubscriptionPeriod:   "year",
			SubscriptionPriceCNY: 100,
			SubscriptionDailyUSD: 10,
		},
		{
			Mode:                 ChannelMonitorCostConversionSubscription,
			SubscriptionPeriod:   ChannelMonitorSubscriptionPeriodMonth,
			SubscriptionPriceCNY: 0,
			SubscriptionDailyUSD: 10,
		},
	}

	for _, config := range tests {
		_, err := NormalizeChannelMonitorCostConversion(config)
		assert.Error(t, err)
	}
}

func TestChannelMonitorCostConversionRoundTrip(t *testing.T) {
	raw, err := MarshalChannelMonitorCostConversion(ChannelMonitorCostConversion{
		Mode:        ChannelMonitorCostConversionRecharge,
		PaidCNY:     100,
		CreditedUSD: 200,
	})
	require.NoError(t, err)

	parsed, err := ParseChannelMonitorCostConversion(raw)
	require.NoError(t, err)
	assert.Equal(t, ChannelMonitorCostConversionRecharge, parsed.Mode)
	assert.Equal(t, 100.0, parsed.PaidCNY)
	assert.Equal(t, 200.0, parsed.CreditedUSD)

	parsed, err = ParseChannelMonitorCostConversion("")
	require.NoError(t, err)
	assert.Equal(t, ChannelMonitorCostConversionNone, parsed.Mode)
}

func TestCalculateChannelMonitorCostRatioRejectsOverflow(t *testing.T) {
	_, _, err := CalculateChannelMonitorCostRatio(2, ChannelMonitorCostConversion{
		Mode:        ChannelMonitorCostConversionRecharge,
		PaidCNY:     1_000_000,
		CreditedUSD: 1,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "成本倍率")
}
