package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func TestGetPayMoneyUsesTieredDiscounts(t *testing.T) {
	originalPrice := operation_setting.Price
	originalQuotaDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	originalDiscounts := make(map[int]float64, len(operation_setting.GetPaymentSetting().AmountDiscount))
	for k, v := range operation_setting.GetPaymentSetting().AmountDiscount {
		originalDiscounts[k] = v
	}
	originalTopupGroupRatio := common.TopupGroupRatio2JSONString()

	t.Cleanup(func() {
		operation_setting.Price = originalPrice
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalQuotaDisplayType
		operation_setting.GetPaymentSetting().AmountDiscount = originalDiscounts
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(originalTopupGroupRatio))
	})

	operation_setting.Price = 0.2
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{
		1000: 0.9,
		500:  0.93,
	}
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"default":1}`))

	require.InDelta(t, 99.8, getPayMoney(499, "default"), 0.000001)
	require.InDelta(t, 130.2, getPayMoney(700, "default"), 0.000001)
	require.InDelta(t, 360, getPayMoney(2000, "default"), 0.000001)
}
