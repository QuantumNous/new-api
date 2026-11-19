package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPaymentSettingMatchAmountDiscount(t *testing.T) {
	tiered := &PaymentSetting{
		AmountDiscount: map[int]float64{
			100: 0.95,
			200: 0.90,
		},
	}

	testCases := []struct {
		name     string
		setting  *PaymentSetting
		amount   int64
		expected float64
	}{
		{name: "exact 100 tier", setting: tiered, amount: 100, expected: 0.95},
		{name: "105 matches 100 tier", setting: tiered, amount: 105, expected: 0.95},
		{name: "199 matches 100 tier", setting: tiered, amount: 199, expected: 0.95},
		{name: "exact 200 tier", setting: tiered, amount: 200, expected: 0.90},
		{name: "250 matches 200 tier", setting: tiered, amount: 250, expected: 0.90},
		{name: "below lowest tier returns 1.0", setting: tiered, amount: 99, expected: 1.0},
		{name: "zero amount returns 1.0", setting: tiered, amount: 0, expected: 1.0},
		{name: "empty map returns 1.0", setting: &PaymentSetting{AmountDiscount: map[int]float64{}}, amount: 105, expected: 1.0},
		{name: "nil map returns 1.0", setting: &PaymentSetting{}, amount: 105, expected: 1.0},
		{name: "nil receiver returns 1.0", setting: nil, amount: 105, expected: 1.0},
		{
			name: "non-positive keys and rates are ignored",
			setting: &PaymentSetting{
				AmountDiscount: map[int]float64{
					-50: 0.5,
					0:   0.6,
					100: 0.95,
					200: 0,
					300: -0.8,
				},
			},
			amount:   350,
			expected: 0.95,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.InDelta(t, tc.expected, tc.setting.MatchAmountDiscount(tc.amount), 1e-9)
		})
	}
}
