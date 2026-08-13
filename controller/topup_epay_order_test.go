package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// createEpayTopUpOrder is the single order workflow shared by the legacy
// endpoint (POST /api/user/pay) and the Vue contract
// (POST /api/next/wallet/topup). Its pre-flight validation (availability,
// payment-method whitelist, minimum amount) must reject bad requests before
// any database or upstream payment call is made.
func TestCreateEpayTopUpOrderValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)

	paymentSetting := operation_setting.GetPaymentSetting()
	generalSetting := operation_setting.GetGeneralSetting()
	origConfirmed := paymentSetting.ComplianceConfirmed
	origVersion := paymentSetting.ComplianceTermsVersion
	origPayMethods := operation_setting.PayMethods
	origPayAddress := operation_setting.PayAddress
	origEpayId := operation_setting.EpayId
	origEpayKey := operation_setting.EpayKey
	origMinTopUp := operation_setting.MinTopUp
	origDisplayType := generalSetting.QuotaDisplayType
	t.Cleanup(func() {
		paymentSetting.ComplianceConfirmed = origConfirmed
		paymentSetting.ComplianceTermsVersion = origVersion
		operation_setting.PayMethods = origPayMethods
		operation_setting.PayAddress = origPayAddress
		operation_setting.EpayId = origEpayId
		operation_setting.EpayKey = origEpayKey
		operation_setting.MinTopUp = origMinTopUp
		generalSetting.QuotaDisplayType = origDisplayType
	})

	enableEpay := func() {
		paymentSetting.ComplianceConfirmed = true
		paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
		operation_setting.PayMethods = []map[string]string{
			{"name": "支付宝", "type": "alipay"},
		}
		operation_setting.PayAddress = "https://epay.example.com"
		operation_setting.EpayId = "pid"
		operation_setting.EpayKey = "key"
		operation_setting.MinTopUp = 5
		generalSetting.QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	}

	tests := []struct {
		name     string
		setup    func()
		amount   int64
		method   string
		wantCode string
	}{
		{
			name: "rejects orders while epay is unavailable",
			setup: func() {
				enableEpay()
				paymentSetting.ComplianceConfirmed = false
			},
			amount:   10,
			method:   "alipay",
			wantCode: "PAYMENT_UNAVAILABLE",
		},
		{
			name:     "rejects payment methods outside the whitelist",
			setup:    enableEpay,
			amount:   10,
			method:   "paypal",
			wantCode: "PAYMENT_UNAVAILABLE",
		},
		{
			name:     "rejects empty payment methods",
			setup:    enableEpay,
			amount:   10,
			method:   "",
			wantCode: "PAYMENT_UNAVAILABLE",
		},
		{
			name:     "rejects amounts below the configured minimum",
			setup:    enableEpay,
			amount:   4,
			method:   "alipay",
			wantCode: "VALIDATION_ERROR",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			order, orderErr := createEpayTopUpOrder(ctx, 1, tt.amount, tt.method)
			require.NotNil(t, orderErr)
			assert.Nil(t, order)
			assert.Equal(t, tt.wantCode, orderErr.Code)
		})
	}
}
