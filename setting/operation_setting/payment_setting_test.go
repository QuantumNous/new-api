package operation_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestAmountDiscountConfigThresholds(t *testing.T) {
	var discounts AmountDiscountConfig
	err := common.Unmarshal([]byte(`[
		{"min_amount":100,"discount":0.95},
		{"min_amount":200,"discount":0.9},
		{"min_amount":150,"discount":0.92}
	]`), &discounts)
	require.NoError(t, err)

	require.Equal(t, 1.0, discounts.DiscountForAmount(99))
	require.Equal(t, 0.95, discounts.DiscountForAmount(100))
	require.Equal(t, 0.92, discounts.DiscountForAmount(151))
	require.Equal(t, 0.9, discounts.DiscountForAmount(250))
}

func TestAmountDiscountConfigExactAmountCompatibility(t *testing.T) {
	var discounts AmountDiscountConfig
	err := common.Unmarshal([]byte(`{"100":0.95}`), &discounts)
	require.NoError(t, err)

	require.Equal(t, 1.0, discounts.DiscountForAmount(99))
	require.Equal(t, 0.95, discounts.DiscountForAmount(100))
}
