package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func TestFormatWaffoPancakeAmount_UsesDisplayPriceString(t *testing.T) {
	testCases := []struct {
		name     string
		amount   float64
		expected string
	}{
		{name: "whole amount", amount: 29, expected: "29.00"},
		{name: "decimal amount", amount: 29.9, expected: "29.90"},
		{name: "round half up to cents", amount: 29.999, expected: "30.00"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, formatWaffoPancakeAmount(tc.amount))
		})
	}
}

func TestGetWaffoPancakeFixedTopUp(t *testing.T) {
	original100 := setting.WaffoPancakeTopUpProduct100ID
	original500 := setting.WaffoPancakeTopUpProduct500ID
	original1000 := setting.WaffoPancakeTopUpProduct1000ID
	t.Cleanup(func() {
		setting.WaffoPancakeTopUpProduct100ID = original100
		setting.WaffoPancakeTopUpProduct500ID = original500
		setting.WaffoPancakeTopUpProduct1000ID = original1000
	})
	setting.WaffoPancakeTopUpProduct100ID = "PROD_100"
	setting.WaffoPancakeTopUpProduct500ID = "PROD_500"
	setting.WaffoPancakeTopUpProduct1000ID = "PROD_1000"

	for _, tc := range []struct {
		amount  int64
		product string
		price   float64
		ok      bool
	}{
		{1000, "PROD_100", 100, true},
		{5000, "PROD_500", 500, true},
		{10000, "PROD_1000", 1000, true},
		{100, "", 0, false},
	} {
		product, price, ok := getWaffoPancakeFixedTopUp(tc.amount)
		require.Equal(t, tc.ok, ok)
		require.Equal(t, tc.product, product)
		require.Equal(t, tc.price, price)
	}
}

func TestGetWaffoPancakePayMoney(t *testing.T) {
	originalUnitPrice := setting.WaffoPancakeUnitPrice
	originalQuotaDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	originalDiscounts := make(map[int]float64, len(operation_setting.GetPaymentSetting().AmountDiscount))
	for k, v := range operation_setting.GetPaymentSetting().AmountDiscount {
		originalDiscounts[k] = v
	}
	originalTopupGroupRatio := common.TopupGroupRatio2JSONString()

	t.Cleanup(func() {
		setting.WaffoPancakeUnitPrice = originalUnitPrice
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalQuotaDisplayType
		operation_setting.GetPaymentSetting().AmountDiscount = originalDiscounts
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(originalTopupGroupRatio))
	})

	setting.WaffoPancakeUnitPrice = 2.5
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{
		10:                           0.8,
		int(common.QuotaPerUnit * 3): 0.5,
		20:                           0,
	}
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"default":1,"vip":1.2}`))

	testCases := []struct {
		name             string
		amount           int64
		group            string
		quotaDisplayType string
		expected         float64
	}{
		{
			name:             "currency display applies unit price group ratio and discount",
			amount:           10,
			group:            "vip",
			quotaDisplayType: operation_setting.QuotaDisplayTypeUSD,
			expected:         24,
		},
		{
			name:             "tokens display converts quota to display units before pricing",
			amount:           int64(common.QuotaPerUnit * 3),
			group:            "vip",
			quotaDisplayType: operation_setting.QuotaDisplayTypeTokens,
			expected:         4.5,
		},
		{
			name:             "non-positive discount falls back to no discount",
			amount:           20,
			group:            "default",
			quotaDisplayType: operation_setting.QuotaDisplayTypeUSD,
			expected:         50,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			operation_setting.GetGeneralSetting().QuotaDisplayType = tc.quotaDisplayType
			actual := getWaffoPancakePayMoney(tc.amount, tc.group)
			require.InDelta(t, tc.expected, actual, 0.000001)
		})
	}
}

func TestValidateWaffoPancakeTopUpWebhook(t *testing.T) {
	originalStoreID := setting.WaffoPancakeStoreID
	originalCurrency := setting.WaffoPancakeCurrency
	setting.WaffoPancakeStoreID = "STO_test"
	setting.WaffoPancakeCurrency = "CNY"
	t.Cleanup(func() {
		setting.WaffoPancakeStoreID = originalStoreID
		setting.WaffoPancakeCurrency = originalCurrency
	})

	topUp := &model.TopUp{Money: 50.005}
	validEvent := func() *service.WaffoPancakeWebhookEvent {
		return &service.WaffoPancakeWebhookEvent{
			StoreID: "STO_test",
			Data: service.WaffoPancakeWebhookData{
				Currency: "CNY",
				Amount:   "50.01",
			},
		}
	}

	t.Run("accepts exact rounded checkout price", func(t *testing.T) {
		require.NoError(t, validateWaffoPancakeTopUpWebhook(validEvent(), topUp))
	})
	t.Run("rejects different store", func(t *testing.T) {
		event := validEvent()
		event.StoreID = "STO_other"
		require.ErrorContains(t, validateWaffoPancakeTopUpWebhook(event, topUp), "store id mismatch")
	})
	t.Run("rejects an event in another currency", func(t *testing.T) {
		event := validEvent()
		event.Data.Currency = "USD"
		require.ErrorContains(t, validateWaffoPancakeTopUpWebhook(event, topUp), "currency mismatch")
	})
	t.Run("rejects a changed payment amount", func(t *testing.T) {
		event := validEvent()
		event.Data.Amount = "50.02"
		require.ErrorContains(t, validateWaffoPancakeTopUpWebhook(event, topUp), "amount mismatch")
	})
	t.Run("rejects malformed payment amount", func(t *testing.T) {
		event := validEvent()
		event.Data.Amount = "not-a-number"
		require.ErrorContains(t, validateWaffoPancakeTopUpWebhook(event, topUp), "invalid webhook amount")
	})
}
