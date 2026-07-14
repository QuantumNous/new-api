package common

import (
	"math"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"
)

func TestQuotaFromFloatSaturatesOutOfRangeValues(t *testing.T) {
	tests := []struct {
		name string
		in   float64
		want int
	}{
		{name: "overflow", in: math.MaxFloat64, want: MaxQuota},
		{name: "underflow", in: -math.MaxFloat64, want: MinQuota},
		{name: "nan", in: math.NaN(), want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := QuotaFromFloat(tt.in)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestQuotaRoundStrictRejectsSaturation(t *testing.T) {
	quota, err := QuotaRoundStrict(float64(MaxQuota) + 1)

	require.Error(t, err)
	require.Zero(t, quota)
	clamp, ok := err.(*QuotaClamp)
	require.True(t, ok)
	require.Equal(t, QuotaClampOverflow, clamp.Kind)
}

func TestQuotaRoundStrictAcceptsIntegerBounds(t *testing.T) {
	maxQuota, maxErr := QuotaRoundStrict(float64(MaxQuota))
	minQuota, minErr := QuotaRoundStrict(float64(MinQuota))

	require.NoError(t, maxErr)
	require.NoError(t, minErr)
	require.Equal(t, MaxQuota, maxQuota)
	require.Equal(t, MinQuota, minQuota)
}

func TestQuotaClampNaNIsJSONSafe(t *testing.T) {
	_, clamp := QuotaFromFloatChecked(math.NaN())
	require.NotNil(t, clamp)

	data, err := Marshal(clamp)

	require.NoError(t, err)
	require.Contains(t, string(data), `"original":"NaN"`)
}

func TestQuotaFromDecimalRoundsBeforeSaturating(t *testing.T) {
	quota := QuotaFromDecimal(decimal.NewFromFloat(1.5))

	require.Equal(t, 2, quota)
}
