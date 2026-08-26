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
	setting.WaffoPancakeStoreID = "STO_test"
	t.Cleanup(func() { setting.WaffoPancakeStoreID = originalStoreID })

	topUp := &model.TopUp{Money: 50.005}
	validEvent := func() *service.WaffoPancakeWebhookEvent {
		return &service.WaffoPancakeWebhookEvent{
			StoreID: "STO_test",
			Data: service.WaffoPancakeWebhookData{
				Currency: "USD",
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
	t.Run("rejects a non USD event", func(t *testing.T) {
		event := validEvent()
		event.Data.Currency = "CNY"
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
