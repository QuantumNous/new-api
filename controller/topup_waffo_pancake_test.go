package controller

import (
	"encoding/json"
	"maps"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
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
	maps.Copy(originalDiscounts, operation_setting.GetPaymentSetting().AmountDiscount)
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

func TestGlobalMinTopUpEnforcedOnWaffoPancakeAndTopUpInfo(t *testing.T) {
	oldDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	oldMinTopUp := operation_setting.MinTopUp
	oldWaffoPancakeMin := setting.WaffoPancakeMinTopUp
	oldWaffoMin := setting.WaffoMinTopUp
	oldStripeMin := setting.StripeMinTopUp
	oldWaffoPancakeMerchantID := setting.WaffoPancakeMerchantID
	oldWaffoPancakePrivateKey := setting.WaffoPancakePrivateKey
	oldWaffoPancakeProductID := setting.WaffoPancakeProductID
	oldWaffoEnabled := setting.WaffoEnabled
	oldWaffoSandbox := setting.WaffoSandbox
	oldWaffoApiKey := setting.WaffoApiKey
	oldWaffoPrivateKey := setting.WaffoPrivateKey
	oldWaffoPublicCert := setting.WaffoPublicCert
	oldStripeSecret := setting.StripeApiSecret
	oldStripeWebhook := setting.StripeWebhookSecret
	oldStripePrice := setting.StripePriceId
	oldComplianceConfirmed := operation_setting.GetPaymentSetting().ComplianceConfirmed
	oldComplianceVersion := operation_setting.GetPaymentSetting().ComplianceTermsVersion

	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = oldDisplayType
		operation_setting.MinTopUp = oldMinTopUp
		setting.WaffoPancakeMinTopUp = oldWaffoPancakeMin
		setting.WaffoMinTopUp = oldWaffoMin
		setting.StripeMinTopUp = oldStripeMin
		setting.WaffoPancakeMerchantID = oldWaffoPancakeMerchantID
		setting.WaffoPancakePrivateKey = oldWaffoPancakePrivateKey
		setting.WaffoPancakeProductID = oldWaffoPancakeProductID
		setting.WaffoEnabled = oldWaffoEnabled
		setting.WaffoSandbox = oldWaffoSandbox
		setting.WaffoApiKey = oldWaffoApiKey
		setting.WaffoPrivateKey = oldWaffoPrivateKey
		setting.WaffoPublicCert = oldWaffoPublicCert
		setting.StripeApiSecret = oldStripeSecret
		setting.StripeWebhookSecret = oldStripeWebhook
		setting.StripePriceId = oldStripePrice
		operation_setting.GetPaymentSetting().ComplianceConfirmed = oldComplianceConfirmed
		operation_setting.GetPaymentSetting().ComplianceTermsVersion = oldComplianceVersion
	})

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	operation_setting.MinTopUp = 10
	setting.WaffoPancakeMinTopUp = 1
	setting.WaffoMinTopUp = 1
	setting.StripeMinTopUp = 1

	operation_setting.GetPaymentSetting().ComplianceConfirmed = true
	operation_setting.GetPaymentSetting().ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	setting.WaffoPancakeMerchantID = "merchant_test"
	setting.WaffoPancakePrivateKey = "private_test"
	setting.WaffoPancakeProductID = "product_test"
	setting.WaffoEnabled = true
	setting.WaffoSandbox = false
	setting.WaffoApiKey = "waffo_key"
	setting.WaffoPrivateKey = "waffo_priv"
	setting.WaffoPublicCert = "waffo_pub"
	setting.StripeApiSecret = "sk_test_123"
	setting.StripeWebhookSecret = "whsec_test_123"
	setting.StripePriceId = "price_test_123"

	gin.SetMode(gin.TestMode)

	t.Run("RequestWaffoPancakeAmount rejects amount below MinTopUp", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/waffo-pancake/amount", strings.NewReader(`{"amount":5}`))
		ctx.Request.Header.Set("Content-Type", "application/json")

		RequestWaffoPancakeAmount(ctx)

		require.Equal(t, http.StatusOK, recorder.Code)
		require.JSONEq(t, `{"message":"error","data":"Top-up amount cannot be less than 10","message_key":"Top-up amount cannot be less than {{min}}","message_params":{"min":10}}`, recorder.Body.String())
	})

	t.Run("RequestWaffoPancakePay rejects amount below MinTopUp", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/waffo-pancake/pay", strings.NewReader(`{"amount":5}`))
		ctx.Request.Header.Set("Content-Type", "application/json")

		RequestWaffoPancakePay(ctx)

		require.Equal(t, http.StatusOK, recorder.Code)
		require.JSONEq(t, `{"message":"error","data":"Top-up amount cannot be less than 10","message_key":"Top-up amount cannot be less than {{min}}","message_params":{"min":10}}`, recorder.Body.String())
	})

	t.Run("RequestWaffoAmount and RequestWaffoPay reject amount below MinTopUp", func(t *testing.T) {
		recAmount := httptest.NewRecorder()
		ctxAmount, _ := gin.CreateTestContext(recAmount)
		ctxAmount.Request = httptest.NewRequest(http.MethodPost, "/api/user/waffo/amount", strings.NewReader(`{"amount":5}`))
		ctxAmount.Request.Header.Set("Content-Type", "application/json")
		RequestWaffoAmount(ctxAmount)
		require.JSONEq(t, `{"message":"error","data":"Top-up amount cannot be less than 10","message_key":"Top-up amount cannot be less than {{min}}","message_params":{"min":10}}`, recAmount.Body.String())

		recPay := httptest.NewRecorder()
		ctxPay, _ := gin.CreateTestContext(recPay)
		ctxPay.Request = httptest.NewRequest(http.MethodPost, "/api/user/waffo/pay", strings.NewReader(`{"amount":5}`))
		ctxPay.Request.Header.Set("Content-Type", "application/json")
		RequestWaffoPay(ctxPay)
		require.JSONEq(t, `{"message":"error","data":"Top-up amount cannot be less than 10","message_key":"Top-up amount cannot be less than {{min}}","message_params":{"min":10}}`, recPay.Body.String())
	})

	t.Run("RequestStripeAmount rejects amount below MinTopUp", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/stripe/amount", strings.NewReader(`{"amount":5}`))
		ctx.Request.Header.Set("Content-Type", "application/json")
		RequestStripeAmount(ctx)
		require.JSONEq(t, `{"message":"error","data":"Top-up amount cannot be less than 10","message_key":"Top-up amount cannot be less than {{min}}","message_params":{"min":10}}`, recorder.Body.String())
	})

	t.Run("GetTopUpInfo reports effective minimum floor of 10 across gateways and pay_methods", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/topup/info", nil)

		GetTopUpInfo(ctx)

		require.Equal(t, http.StatusOK, recorder.Code)
		var resp struct {
			Success bool `json:"success"`
			Data    struct {
				MinTopUp             int                 `json:"min_topup"`
				StripeMinTopUp       int                 `json:"stripe_min_topup"`
				WaffoMinTopUp        int                 `json:"waffo_min_topup"`
				WaffoPancakeMinTopUp int                 `json:"waffo_pancake_min_topup"`
				PayMethods           []map[string]string `json:"pay_methods"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &resp))
		require.True(t, resp.Success)
		require.Equal(t, 10, resp.Data.MinTopUp)
		require.Equal(t, 10, resp.Data.StripeMinTopUp)
		require.Equal(t, 10, resp.Data.WaffoMinTopUp)
		require.Equal(t, 10, resp.Data.WaffoPancakeMinTopUp)

		methodsByType := make(map[string]map[string]string, len(resp.Data.PayMethods))
		for _, m := range resp.Data.PayMethods {
			methodsByType[m["type"]] = m
		}
		require.Equal(t, "10", methodsByType[model.PaymentMethodWaffoPancake]["min_topup"])
		require.Equal(t, "10", methodsByType[model.PaymentMethodWaffo]["min_topup"])
		require.Equal(t, "10", methodsByType["stripe"]["min_topup"])
		require.Equal(t, "50", methodsByType["custom1"]["min_topup"])
	})
}
