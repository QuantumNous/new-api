package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func confirmPaymentComplianceForTest(t *testing.T) *operation_setting.PaymentSetting {
	t.Helper()

	paymentSetting := operation_setting.GetPaymentSetting()
	originalConfirmed := paymentSetting.ComplianceConfirmed
	originalTermsVersion := paymentSetting.ComplianceTermsVersion
	originalFeatures := operation_setting.CopyBusinessFeatures(paymentSetting.BusinessFeatures)
	originalScopes := operation_setting.CopyProviderSceneScopes(paymentSetting.ProviderSceneScopes)
	t.Cleanup(func() {
		paymentSetting.ComplianceConfirmed = originalConfirmed
		paymentSetting.ComplianceTermsVersion = originalTermsVersion
		paymentSetting.BusinessFeatures = originalFeatures
		paymentSetting.ProviderSceneScopes = originalScopes
	})

	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	paymentSetting.BusinessFeatures = operation_setting.DefaultBusinessFeatures()
	paymentSetting.ProviderSceneScopes = operation_setting.DefaultProviderSceneScopes()
	return paymentSetting
}

func TestStripeSceneAvailabilityAndWebhookAreSeparated(t *testing.T) {
	paymentSetting := confirmPaymentComplianceForTest(t)
	originalAPISecret := setting.StripeApiSecret
	originalWebhookSecret := setting.StripeWebhookSecret
	originalPriceID := setting.StripePriceId
	t.Cleanup(func() {
		setting.StripeApiSecret = originalAPISecret
		setting.StripeWebhookSecret = originalWebhookSecret
		setting.StripePriceId = originalPriceID
	})

	setting.StripeApiSecret = "sk_test_123"
	setting.StripeWebhookSecret = "whsec_test"
	setting.StripePriceId = "price_123"
	require.True(t, isStripeTopUpEnabled())
	require.True(t, isStripeSubscriptionEnabled())
	require.True(t, isStripeWebhookEnabled())

	paymentSetting.ProviderSceneScopes[operation_setting.PaymentProviderStripe][operation_setting.PaymentSceneWalletTopUp] = false
	require.False(t, isStripeTopUpEnabled())
	require.True(t, isStripeSubscriptionEnabled())
	require.True(t, isStripeWebhookEnabled())

	paymentSetting.ProviderSceneScopes[operation_setting.PaymentProviderStripe][operation_setting.PaymentSceneSubscriptionPurchase] = false
	require.False(t, isStripeSubscriptionEnabled())
	require.True(t, isStripeWebhookEnabled())

	paymentSetting.ProviderSceneScopes[operation_setting.PaymentProviderStripe][operation_setting.PaymentSceneWalletTopUp] = true
	paymentSetting.ProviderSceneScopes[operation_setting.PaymentProviderStripe][operation_setting.PaymentSceneSubscriptionPurchase] = true
	setting.StripePriceId = ""
	require.False(t, isStripeTopUpEnabled())
	require.True(t, isStripeSubscriptionEnabled())
	require.True(t, isStripeWebhookEnabled())

	setting.StripeWebhookSecret = ""
	require.False(t, isStripeTopUpEnabled())
	require.False(t, isStripeSubscriptionEnabled())
	require.False(t, isStripeWebhookEnabled())
}

func TestCreemSceneAvailabilityAndWebhookAreSeparated(t *testing.T) {
	paymentSetting := confirmPaymentComplianceForTest(t)
	originalAPIKey := setting.CreemApiKey
	originalProducts := setting.CreemProducts
	originalWebhookSecret := setting.CreemWebhookSecret
	originalTestMode := setting.CreemTestMode
	t.Cleanup(func() {
		setting.CreemApiKey = originalAPIKey
		setting.CreemProducts = originalProducts
		setting.CreemWebhookSecret = originalWebhookSecret
		setting.CreemTestMode = originalTestMode
	})

	setting.CreemApiKey = "creem_api_key"
	setting.CreemProducts = `[{"productId":"prod_123"}]`
	setting.CreemWebhookSecret = "creem_secret"
	setting.CreemTestMode = false
	require.True(t, isCreemTopUpEnabled())
	require.True(t, isCreemSubscriptionEnabled())
	require.True(t, isCreemWebhookEnabled())

	setting.CreemProducts = "[]"
	require.False(t, isCreemTopUpEnabled())
	require.True(t, isCreemSubscriptionEnabled())
	require.True(t, isCreemWebhookEnabled())

	setting.CreemProducts = `[{"productId":"prod_123"}]`
	paymentSetting.ProviderSceneScopes[operation_setting.PaymentProviderCreem][operation_setting.PaymentSceneWalletTopUp] = false
	require.False(t, isCreemTopUpEnabled())
	require.True(t, isCreemSubscriptionEnabled())
	require.True(t, isCreemWebhookEnabled())

	setting.CreemWebhookSecret = ""
	require.False(t, isCreemTopUpEnabled())
	require.False(t, isCreemSubscriptionEnabled())
	require.False(t, isCreemWebhookEnabled())

	setting.CreemTestMode = true
	require.False(t, isCreemTopUpEnabled())
	require.True(t, isCreemSubscriptionEnabled())
	require.True(t, isCreemWebhookEnabled())
}

func TestEpaySceneAvailabilityAndWebhookAreSeparated(t *testing.T) {
	paymentSetting := confirmPaymentComplianceForTest(t)
	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalPayMethods := operation_setting.PayMethods
	t.Cleanup(func() {
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		operation_setting.PayMethods = originalPayMethods
	})

	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "epay_id"
	operation_setting.EpayKey = "epay_key"
	operation_setting.PayMethods = []map[string]string{{"type": "alipay"}}
	require.True(t, isEpayTopUpEnabled())
	require.True(t, isEpaySubscriptionEnabled())
	require.True(t, isEpayWebhookEnabled())

	operation_setting.PayMethods = nil
	require.False(t, isEpayTopUpEnabled())
	require.False(t, isEpaySubscriptionEnabled())
	require.True(t, isEpayWebhookEnabled())

	operation_setting.PayMethods = []map[string]string{{"type": "alipay"}}
	paymentSetting.ProviderSceneScopes[operation_setting.PaymentProviderEpay][operation_setting.PaymentSceneWalletTopUp] = false
	require.False(t, isEpayTopUpEnabled())
	require.True(t, isEpaySubscriptionEnabled())
	require.True(t, isEpayWebhookEnabled())

	operation_setting.EpayKey = ""
	require.False(t, isEpayTopUpEnabled())
	require.False(t, isEpaySubscriptionEnabled())
	require.False(t, isEpayWebhookEnabled())
}

func TestWaffoSceneAvailabilityAndWebhookAreSeparated(t *testing.T) {
	paymentSetting := confirmPaymentComplianceForTest(t)
	originalEnabled := setting.WaffoEnabled
	originalSandbox := setting.WaffoSandbox
	originalAPIKey := setting.WaffoApiKey
	originalPrivateKey := setting.WaffoPrivateKey
	originalPublicCert := setting.WaffoPublicCert
	t.Cleanup(func() {
		setting.WaffoEnabled = originalEnabled
		setting.WaffoSandbox = originalSandbox
		setting.WaffoApiKey = originalAPIKey
		setting.WaffoPrivateKey = originalPrivateKey
		setting.WaffoPublicCert = originalPublicCert
	})

	setting.WaffoEnabled = true
	setting.WaffoSandbox = false
	setting.WaffoApiKey = "api"
	setting.WaffoPrivateKey = "private"
	setting.WaffoPublicCert = "public"
	require.True(t, isWaffoTopUpEnabled())
	require.True(t, isWaffoWebhookEnabled())

	paymentSetting.ProviderSceneScopes[operation_setting.PaymentProviderWaffo][operation_setting.PaymentSceneWalletTopUp] = false
	require.False(t, isWaffoTopUpEnabled())
	require.True(t, isWaffoWebhookEnabled())

	setting.WaffoEnabled = false
	require.False(t, isWaffoTopUpEnabled())
	require.False(t, isWaffoWebhookEnabled())
}

func TestWaffoPancakeSceneAvailabilityAndWebhookAreSeparated(t *testing.T) {
	paymentSetting := confirmPaymentComplianceForTest(t)
	originalMerchantID := setting.WaffoPancakeMerchantID
	originalPrivateKey := setting.WaffoPancakePrivateKey
	originalStoreID := setting.WaffoPancakeStoreID
	originalProductID := setting.WaffoPancakeProductID
	t.Cleanup(func() {
		setting.WaffoPancakeMerchantID = originalMerchantID
		setting.WaffoPancakePrivateKey = originalPrivateKey
		setting.WaffoPancakeStoreID = originalStoreID
		setting.WaffoPancakeProductID = originalProductID
	})

	setting.WaffoPancakeMerchantID = "merchant"
	setting.WaffoPancakePrivateKey = "private"
	setting.WaffoPancakeStoreID = "store"
	setting.WaffoPancakeProductID = "product"
	require.True(t, isWaffoPancakeTopUpEnabled())
	require.True(t, isWaffoPancakeWebhookEnabled())

	paymentSetting.ProviderSceneScopes[operation_setting.PaymentProviderWaffoPancake][operation_setting.PaymentSceneWalletTopUp] = false
	require.False(t, isWaffoPancakeTopUpEnabled())
	require.True(t, isWaffoPancakeWebhookEnabled())

	paymentSetting.ProviderSceneScopes[operation_setting.PaymentProviderWaffoPancake][operation_setting.PaymentSceneWalletTopUp] = true
	setting.WaffoPancakeStoreID = ""
	require.False(t, isWaffoPancakeTopUpEnabled())
	require.False(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeStoreID = "store"
	setting.WaffoPancakeProductID = ""
	require.False(t, isWaffoPancakeTopUpEnabled())
	require.False(t, isWaffoPancakeWebhookEnabled())
}
