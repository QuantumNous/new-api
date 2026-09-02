package operation_setting

import (
	"math"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidatePaymentFeeOption(t *testing.T) {
	for _, value := range []string{"0", "1.25", " 3 "} {
		require.NoError(t, ValidatePaymentFeeOption(EpayFeePercentOptionKey, value))
	}

	for _, value := range []string{"", "-0.01", "NaN", "+Inf", "not-a-number"} {
		require.Error(t, ValidatePaymentFeeOption(StripeFeeFixedOptionKey, value))
	}

	require.NoError(t, ValidatePaymentFeeOption("unrelated.option", "not-a-number"))
}

func TestApplyPaymentFee(t *testing.T) {
	actual, ok := ApplyPaymentFee(decimal.RequireFromString("20"), 5, 0.5)
	require.True(t, ok)
	assert.True(t, actual.Equal(decimal.RequireFromString("21.5")))

	actual, ok = ApplyPaymentFee(decimal.RequireFromString("20"), 0, 0)
	require.True(t, ok)
	assert.True(t, actual.Equal(decimal.RequireFromString("20")))
}

func TestApplyPaymentFeeRejectsInvalidConfiguration(t *testing.T) {
	for _, fees := range [][2]float64{
		{-1, 0},
		{0, -1},
		{math.NaN(), 0},
		{0, math.Inf(1)},
	} {
		actual, ok := ApplyPaymentFee(decimal.NewFromInt(10), fees[0], fees[1])
		assert.False(t, ok)
		assert.True(t, actual.IsZero())
	}
}
