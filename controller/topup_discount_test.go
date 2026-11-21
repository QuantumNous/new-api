package controller

import (
	"maps"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func TestTieredAmountDiscountAcrossGateways(t *testing.T) {
	originalDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	originalPrice := operation_setting.Price
	originalWaffoUnitPrice := setting.WaffoUnitPrice
	originalWaffoPancakeUnitPrice := setting.WaffoPancakeUnitPrice
	originalDiscounts := make(map[int]float64, len(operation_setting.GetPaymentSetting().AmountDiscount))
	maps.Copy(originalDiscounts, operation_setting.GetPaymentSetting().AmountDiscount)
	originalTopupGroupRatio := common.TopupGroupRatio2JSONString()

	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalDisplayType
		operation_setting.Price = originalPrice
		setting.WaffoUnitPrice = originalWaffoUnitPrice
		setting.WaffoPancakeUnitPrice = originalWaffoPancakeUnitPrice
		operation_setting.GetPaymentSetting().AmountDiscount = originalDiscounts
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(originalTopupGroupRatio))
	})

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	operation_setting.Price = 1.0
	setting.WaffoUnitPrice = 1.0
	setting.WaffoPancakeUnitPrice = 2.5
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{
		100: 0.95,
		200: 0.90,
	}
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"default":1}`))

	require.InDelta(t, 99.75, getPayMoney(105, "default"), 1e-6)
	require.InDelta(t, 99.75, getWaffoPayMoney(105, "default"), 1e-6)
	require.InDelta(t, 249.375, getWaffoPancakePayMoney(105, "default"), 1e-6)
	require.InDelta(t, 225.0, getPayMoney(250, "default"), 1e-6)
	require.InDelta(t, 225.0, getWaffoPayMoney(250, "default"), 1e-6)
	require.InDelta(t, 562.5, getWaffoPancakePayMoney(250, "default"), 1e-6)
	require.InDelta(t, 99.0, getPayMoney(99, "default"), 1e-6)
}
