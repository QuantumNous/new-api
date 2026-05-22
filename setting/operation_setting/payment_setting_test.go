package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestResolveAmountDiscount(t *testing.T) {
	discounts := map[int]float64{
		1000: 0.9,
		500:  0.93,
		3000: 0.85,
	}

	testCases := []struct {
		name      string
		amount    int64
		discounts map[int]float64
		expected  float64
	}{
		{
			name:      "below first tier uses no discount",
			amount:    499,
			discounts: discounts,
			expected:  1,
		},
		{
			name:      "exact first tier uses first discount",
			amount:    500,
			discounts: discounts,
			expected:  0.93,
		},
		{
			name:      "between tiers uses highest eligible tier",
			amount:    700,
			discounts: discounts,
			expected:  0.93,
		},
		{
			name:      "exact higher tier uses higher discount",
			amount:    1000,
			discounts: discounts,
			expected:  0.9,
		},
		{
			name:      "above highest configured tier keeps highest discount",
			amount:    2000,
			discounts: discounts,
			expected:  0.9,
		},
		{
			name:   "ignores invalid threshold and discount values",
			amount: 2000,
			discounts: map[int]float64{
				0:    0.1,
				100:  0,
				200:  -0.5,
				1000: 0.9,
			},
			expected: 0.9,
		},
		{
			name:      "empty discounts use no discount",
			amount:    2000,
			discounts: map[int]float64{},
			expected:  1,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, ResolveAmountDiscount(tc.amount, tc.discounts))
		})
	}
}
