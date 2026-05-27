package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func TestBillingCapabilitiesRespectBusinessFeaturesAndDoNotExposeSecrets(t *testing.T) {
	paymentSetting := confirmPaymentComplianceForTest(t)
	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalPayMethods := operation_setting.PayMethods
	originalStripeSecret := setting.StripeApiSecret
	originalStripeWebhookSecret := setting.StripeWebhookSecret
	originalStripePriceID := setting.StripePriceId
	t.Cleanup(func() {
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		operation_setting.PayMethods = originalPayMethods
		setting.StripeApiSecret = originalStripeSecret
		setting.StripeWebhookSecret = originalStripeWebhookSecret
		setting.StripePriceId = originalStripePriceID
	})

	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "epay_id"
	operation_setting.EpayKey = "epay_key_should_not_leak"
	operation_setting.PayMethods = []map[string]string{{"type": "alipay", "name": "Alipay"}}
	setting.StripeApiSecret = "sk_test_should_not_leak"
	setting.StripeWebhookSecret = "whsec_should_not_leak"
	setting.StripePriceId = "price_123"
	paymentSetting.BusinessFeatures[operation_setting.BillingFeatureWalletTopUp] = false

	data := buildBillingCapabilitiesData()
	features := data["features"].(map[string]bool)
	require.False(t, features[operation_setting.BillingFeatureWalletTopUp])
	require.True(t, features[operation_setting.BillingFeatureSubscriptionPurchase])
	require.NotContains(t, features, operation_setting.BillingFeatureInvitationReward)
	require.NotContains(t, features, operation_setting.BillingFeatureCheckinReward)

	paymentMethods := data["payment_methods"].(map[string][]map[string]string)
	require.Empty(t, paymentMethods[operation_setting.PaymentSceneWalletTopUp])
	require.NotEmpty(t, paymentMethods[operation_setting.PaymentSceneSubscriptionPurchase])

	payload, err := common.Marshal(data)
	require.NoError(t, err)
	require.NotContains(t, string(payload), "epay_key_should_not_leak")
	require.NotContains(t, string(payload), "sk_test_should_not_leak")
	require.NotContains(t, string(payload), "whsec_should_not_leak")
}
