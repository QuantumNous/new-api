package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newBillingGuardTestContext() (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	return c, recorder
}

func TestRequireWalletTopUpRespectsFeatureAndScene(t *testing.T) {
	paymentSetting := confirmPaymentComplianceForTest(t)

	paymentSetting.BusinessFeatures[operation_setting.BillingFeatureWalletTopUp] = false
	c, recorder := newBillingGuardTestContext()
	require.False(t, requireWalletTopUp(c, operation_setting.PaymentProviderEpay))
	require.Contains(t, recorder.Body.String(), billingFeatureDisabledMessage)

	paymentSetting.BusinessFeatures[operation_setting.BillingFeatureWalletTopUp] = true
	paymentSetting.ProviderSceneScopes[operation_setting.PaymentProviderEpay][operation_setting.PaymentSceneWalletTopUp] = false
	c, recorder = newBillingGuardTestContext()
	require.False(t, requireWalletTopUp(c, operation_setting.PaymentProviderEpay))
	require.Contains(t, recorder.Body.String(), paymentSceneDisabledMessage)

	paymentSetting.ProviderSceneScopes[operation_setting.PaymentProviderEpay][operation_setting.PaymentSceneWalletTopUp] = true
	c, recorder = newBillingGuardTestContext()
	require.True(t, requireWalletTopUp(c, operation_setting.PaymentProviderEpay))
	require.Empty(t, recorder.Body.String())
}

func TestRequireSubscriptionPurchaseRespectsFeatureAndScene(t *testing.T) {
	paymentSetting := confirmPaymentComplianceForTest(t)

	paymentSetting.BusinessFeatures[operation_setting.BillingFeatureSubscriptionPurchase] = false
	c, recorder := newBillingGuardTestContext()
	require.False(t, requireSubscriptionPurchase(c, operation_setting.PaymentProviderStripe))
	require.Contains(t, recorder.Body.String(), billingFeatureDisabledMessage)

	paymentSetting.BusinessFeatures[operation_setting.BillingFeatureSubscriptionPurchase] = true
	paymentSetting.ProviderSceneScopes[operation_setting.PaymentProviderStripe][operation_setting.PaymentSceneSubscriptionPurchase] = false
	c, recorder = newBillingGuardTestContext()
	require.False(t, requireSubscriptionPurchase(c, operation_setting.PaymentProviderStripe))
	require.Contains(t, recorder.Body.String(), paymentSceneDisabledMessage)

	paymentSetting.ProviderSceneScopes[operation_setting.PaymentProviderStripe][operation_setting.PaymentSceneSubscriptionPurchase] = true
	c, recorder = newBillingGuardTestContext()
	require.True(t, requireSubscriptionPurchase(c, operation_setting.PaymentProviderStripe))
	require.Empty(t, recorder.Body.String())
}
