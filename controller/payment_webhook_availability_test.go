package controller

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

var (
	testPaddleLiveAPIKey         = syntheticPaddleAPIKey("pdl_live_apikey_")
	testPaddleSandboxAPIKey      = syntheticPaddleAPIKey("pdl_sdbx_apikey_")
	testPaddleLiveClientToken    = "live_" + strings.Repeat("a", 27)
	testPaddleSandboxClientToken = "test_" + strings.Repeat("b", 27)
	testPaddleProductID          = "pro_" + strings.Repeat("c", 26)
	testPaddleWebhookSettingID   = "SYNTHETICNTFSETID123456789"
	testPaddleWebhookSecretValue = "SYNTHETICWEBHOOKSECRET0000000000"
	testPaddleWebhookSecret      = "pdl_ntfset_" + testPaddleWebhookSettingID + "_" + testPaddleWebhookSecretValue
)

func syntheticPaddleAPIKey(prefix string) string {
	return prefix + strings.Repeat("d", 26) + "_" + strings.Repeat("E", 22) + "_" + strings.Repeat("F", 3)
}

func confirmPaymentComplianceForTest(t *testing.T) {
	t.Helper()
	paymentSetting := operation_setting.GetPaymentSetting()
	originalConfirmed := paymentSetting.ComplianceConfirmed
	originalTermsVersion := paymentSetting.ComplianceTermsVersion
	t.Cleanup(func() {
		paymentSetting.ComplianceConfirmed = originalConfirmed
		paymentSetting.ComplianceTermsVersion = originalTermsVersion
	})
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
}

func TestStripeWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalAPISecret := setting.StripeApiSecret
	originalWebhookSecret := setting.StripeWebhookSecret
	originalPriceID := setting.StripePriceId
	t.Cleanup(func() {
		setting.StripeApiSecret = originalAPISecret
		setting.StripeWebhookSecret = originalWebhookSecret
		setting.StripePriceId = originalPriceID
	})

	setting.StripeWebhookSecret = ""
	setting.StripeApiSecret = "sk_test_123"
	setting.StripePriceId = "price_123"
	require.False(t, isStripeWebhookEnabled())

	setting.StripeWebhookSecret = "whsec_test"
	require.True(t, isStripeWebhookEnabled())

	setting.StripePriceId = ""
	require.False(t, isStripeWebhookEnabled())
}

func TestCreemWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalAPIKey := setting.CreemApiKey
	originalProducts := setting.CreemProducts
	originalWebhookSecret := setting.CreemWebhookSecret
	t.Cleanup(func() {
		setting.CreemApiKey = originalAPIKey
		setting.CreemProducts = originalProducts
		setting.CreemWebhookSecret = originalWebhookSecret
	})

	setting.CreemWebhookSecret = ""
	setting.CreemApiKey = "creem_api_key"
	setting.CreemProducts = `[{"productId":"prod_123"}]`
	require.False(t, isCreemWebhookEnabled())

	setting.CreemWebhookSecret = "creem_secret"
	require.True(t, isCreemWebhookEnabled())

	setting.CreemProducts = "[]"
	require.False(t, isCreemWebhookEnabled())
}

func TestWaffoWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalEnabled := setting.WaffoEnabled
	originalSandbox := setting.WaffoSandbox
	originalAPIKey := setting.WaffoApiKey
	originalPrivateKey := setting.WaffoPrivateKey
	originalPublicCert := setting.WaffoPublicCert
	originalSandboxAPIKey := setting.WaffoSandboxApiKey
	originalSandboxPrivateKey := setting.WaffoSandboxPrivateKey
	originalSandboxPublicCert := setting.WaffoSandboxPublicCert
	t.Cleanup(func() {
		setting.WaffoEnabled = originalEnabled
		setting.WaffoSandbox = originalSandbox
		setting.WaffoApiKey = originalAPIKey
		setting.WaffoPrivateKey = originalPrivateKey
		setting.WaffoPublicCert = originalPublicCert
		setting.WaffoSandboxApiKey = originalSandboxAPIKey
		setting.WaffoSandboxPrivateKey = originalSandboxPrivateKey
		setting.WaffoSandboxPublicCert = originalSandboxPublicCert
	})

	setting.WaffoEnabled = true
	setting.WaffoSandbox = false
	setting.WaffoApiKey = ""
	setting.WaffoPrivateKey = "private"
	setting.WaffoPublicCert = "public"
	require.False(t, isWaffoWebhookEnabled())

	setting.WaffoApiKey = "api"
	require.True(t, isWaffoWebhookEnabled())

	setting.WaffoEnabled = false
	require.False(t, isWaffoWebhookEnabled())

	setting.WaffoEnabled = true
	setting.WaffoSandbox = true
	setting.WaffoSandboxApiKey = ""
	setting.WaffoSandboxPrivateKey = "sandbox_private"
	setting.WaffoSandboxPublicCert = "sandbox_public"
	require.False(t, isWaffoWebhookEnabled())

	setting.WaffoSandboxApiKey = "sandbox_api"
	require.True(t, isWaffoWebhookEnabled())
}

func TestWaffoPancakeWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalMerchantID := setting.WaffoPancakeMerchantID
	originalPrivateKey := setting.WaffoPancakePrivateKey
	originalProductID := setting.WaffoPancakeProductID
	t.Cleanup(func() {
		setting.WaffoPancakeMerchantID = originalMerchantID
		setting.WaffoPancakePrivateKey = originalPrivateKey
		setting.WaffoPancakeProductID = originalProductID
	})

	// Presence of all three credentials enables the gateway. Webhook public
	// keys are bundled in the SDK and there is no separate Enabled toggle —
	// clear any of the three fields to disable.
	setting.WaffoPancakeMerchantID = ""
	setting.WaffoPancakePrivateKey = "private"
	setting.WaffoPancakeProductID = "product"
	require.False(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeMerchantID = "merchant"
	require.True(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeProductID = ""
	require.False(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeProductID = "product"
	setting.WaffoPancakePrivateKey = ""
	require.False(t, isWaffoPancakeWebhookEnabled())
}

func TestEpayWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
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
	operation_setting.EpayKey = ""
	operation_setting.PayMethods = []map[string]string{{"type": "alipay"}}
	require.False(t, isEpayWebhookEnabled())

	operation_setting.EpayKey = "epay_key"
	require.True(t, isEpayWebhookEnabled())

	operation_setting.PayMethods = nil
	require.False(t, isEpayWebhookEnabled())
}

func TestEpayPaymentMethodRejectsStandaloneGateways(t *testing.T) {
	originalPayMethods := operation_setting.PayMethods
	t.Cleanup(func() {
		operation_setting.PayMethods = originalPayMethods
	})

	operation_setting.PayMethods = []map[string]string{
		{"type": "alipay"},
		{"type": "custom1"},
		{"type": model.PaymentMethodPaddle},
		{"type": model.PaymentMethodStripe},
		{"type": model.PaymentMethodCreem},
		{"type": model.PaymentMethodWaffo},
		{"type": model.PaymentMethodWaffoPancake},
	}

	require.True(t, isEpayPaymentMethod("alipay"))
	require.True(t, isEpayPaymentMethod("custom1"))
	require.False(t, isEpayPaymentMethod(model.PaymentMethodPaddle))
	require.False(t, isEpayPaymentMethod(model.PaymentMethodStripe))
	require.False(t, isEpayPaymentMethod(model.PaymentMethodCreem))
	require.False(t, isEpayPaymentMethod(model.PaymentMethodWaffo))
	require.False(t, isEpayPaymentMethod(model.PaymentMethodWaffoPancake))
	require.False(t, isEpayPaymentMethod("missing"))
}

func TestBuildTopUpPayMethodsHidesDisabledPaddle(t *testing.T) {
	source := []map[string]string{
		{"type": "alipay", "name": "Alipay"},
		{"type": model.PaymentMethodPaddle, "name": "Paddle"},
	}

	disabled := buildTopUpPayMethods(source, false)
	require.Len(t, disabled, 1)
	require.Equal(t, "alipay", disabled[0]["type"])

	enabled := buildTopUpPayMethods(source, true)
	require.Len(t, enabled, 2)
	require.Equal(t, model.PaymentMethodPaddle, enabled[1]["type"])

	enabled[0]["name"] = "changed"
	require.Equal(t, "Alipay", source[0]["name"])
}

func TestOnlineTopUpEnabledIncludesPaddle(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalAPIKey := setting.PaddleApiKey
	originalClientToken := setting.PaddleClientToken
	originalWebhookSecret := setting.PaddleWebhookSecret
	originalSandbox := setting.PaddleSandbox
	originalProductID := setting.PaddleProductId
	originalCurrency := setting.PaddleCurrency
	originalUnitPrice := setting.PaddleUnitPrice
	originalMinTopUp := setting.PaddleMinTopUp
	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalPayMethods := operation_setting.PayMethods
	t.Cleanup(func() {
		setting.PaddleApiKey = originalAPIKey
		setting.PaddleClientToken = originalClientToken
		setting.PaddleWebhookSecret = originalWebhookSecret
		setting.PaddleSandbox = originalSandbox
		setting.PaddleProductId = originalProductID
		setting.PaddleCurrency = originalCurrency
		setting.PaddleUnitPrice = originalUnitPrice
		setting.PaddleMinTopUp = originalMinTopUp
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		operation_setting.PayMethods = originalPayMethods
	})

	operation_setting.PayAddress = ""
	operation_setting.EpayId = ""
	operation_setting.EpayKey = ""
	operation_setting.PayMethods = nil
	setting.PaddleSandbox = false
	setting.PaddleApiKey = testPaddleLiveAPIKey
	setting.PaddleClientToken = testPaddleLiveClientToken
	setting.PaddleWebhookSecret = testPaddleWebhookSecret
	setting.PaddleProductId = testPaddleProductID
	setting.PaddleCurrency = "USD"
	setting.PaddleUnitPrice = 1
	setting.PaddleMinTopUp = 1

	require.True(t, isOnlineTopUpEnabled())
}

func TestPaddleTopUpEnabledRequiresEnvironmentMatchedCredentials(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalAPIKey := setting.PaddleApiKey
	originalClientToken := setting.PaddleClientToken
	originalWebhookSecret := setting.PaddleWebhookSecret
	originalSandbox := setting.PaddleSandbox
	originalProductID := setting.PaddleProductId
	originalCurrency := setting.PaddleCurrency
	originalUnitPrice := setting.PaddleUnitPrice
	originalMinTopUp := setting.PaddleMinTopUp
	t.Cleanup(func() {
		setting.PaddleApiKey = originalAPIKey
		setting.PaddleClientToken = originalClientToken
		setting.PaddleWebhookSecret = originalWebhookSecret
		setting.PaddleSandbox = originalSandbox
		setting.PaddleProductId = originalProductID
		setting.PaddleCurrency = originalCurrency
		setting.PaddleUnitPrice = originalUnitPrice
		setting.PaddleMinTopUp = originalMinTopUp
	})

	setting.PaddleProductId = testPaddleProductID
	setting.PaddleCurrency = "USD"
	setting.PaddleUnitPrice = 1
	setting.PaddleMinTopUp = 1
	setting.PaddleWebhookSecret = testPaddleWebhookSecret

	setting.PaddleSandbox = false
	setting.PaddleClientToken = testPaddleLiveClientToken
	setting.PaddleApiKey = "apikey_01example"
	require.False(t, isPaddleTopUpEnabled())
	require.Contains(t, paddleTopUpConfigError(), "pdl_live_apikey_")

	setting.PaddleApiKey = "pdl_sdbx_apikey_example"
	require.False(t, isPaddleTopUpEnabled())

	setting.PaddleApiKey = "pdl_live_apikey_01gtgztp8f4kek3yd4g1wrksa3"
	setting.PaddleClientToken = testPaddleSandboxClientToken
	require.False(t, isPaddleTopUpEnabled())

	setting.PaddleApiKey = testPaddleLiveAPIKey
	setting.PaddleClientToken = testPaddleSandboxClientToken
	require.False(t, isPaddleTopUpEnabled())
	require.Contains(t, paddleTopUpConfigError(), "live_")

	setting.PaddleClientToken = testPaddleLiveClientToken
	require.True(t, isPaddleTopUpEnabled())

	setting.PaddleClientToken = "live_example"
	require.False(t, isPaddleTopUpEnabled())
	require.Contains(t, paddleTopUpConfigError(), "live_")

	setting.PaddleClientToken = testPaddleLiveClientToken
	require.True(t, isPaddleTopUpEnabled())

	setting.PaddleSandbox = true
	require.True(t, isPaddleTopUpEnabled())
	require.False(t, setting.EffectivePaddleSandbox())

	setting.PaddleApiKey = testPaddleSandboxAPIKey
	setting.PaddleClientToken = testPaddleLiveClientToken
	require.False(t, isPaddleTopUpEnabled())
	require.Contains(t, paddleTopUpConfigError(), "test_")

	setting.PaddleClientToken = testPaddleSandboxClientToken
	require.True(t, isPaddleTopUpEnabled())
}

func TestPaddleWebhookEnabledOnlyRequiresEndpointSecret(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalAPIKey := setting.PaddleApiKey
	originalClientToken := setting.PaddleClientToken
	originalWebhookSecret := setting.PaddleWebhookSecret
	originalSandbox := setting.PaddleSandbox
	originalProductID := setting.PaddleProductId
	originalCurrency := setting.PaddleCurrency
	originalUnitPrice := setting.PaddleUnitPrice
	originalMinTopUp := setting.PaddleMinTopUp
	t.Cleanup(func() {
		setting.PaddleApiKey = originalAPIKey
		setting.PaddleClientToken = originalClientToken
		setting.PaddleWebhookSecret = originalWebhookSecret
		setting.PaddleSandbox = originalSandbox
		setting.PaddleProductId = originalProductID
		setting.PaddleCurrency = originalCurrency
		setting.PaddleUnitPrice = originalUnitPrice
		setting.PaddleMinTopUp = originalMinTopUp
	})

	setting.PaddleSandbox = false
	setting.PaddleApiKey = ""
	setting.PaddleClientToken = ""
	setting.PaddleProductId = ""
	setting.PaddleCurrency = ""
	setting.PaddleUnitPrice = 0
	setting.PaddleMinTopUp = 0

	setting.PaddleWebhookSecret = ""
	require.False(t, isPaddleWebhookEnabled())

	setting.PaddleWebhookSecret = testPaddleWebhookSecret
	require.True(t, isPaddleWebhookEnabled())
	require.False(t, isPaddleTopUpEnabled())

	setting.PaddleWebhookSecret = " \n" + testPaddleWebhookSecret + "\t"
	require.True(t, isPaddleWebhookEnabled())
}

func TestPaddleWebhookSecretRejectsNotificationSettingID(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalAPIKey := setting.PaddleApiKey
	originalClientToken := setting.PaddleClientToken
	originalWebhookSecret := setting.PaddleWebhookSecret
	originalSandbox := setting.PaddleSandbox
	originalProductID := setting.PaddleProductId
	originalCurrency := setting.PaddleCurrency
	originalUnitPrice := setting.PaddleUnitPrice
	originalMinTopUp := setting.PaddleMinTopUp
	t.Cleanup(func() {
		setting.PaddleApiKey = originalAPIKey
		setting.PaddleClientToken = originalClientToken
		setting.PaddleWebhookSecret = originalWebhookSecret
		setting.PaddleSandbox = originalSandbox
		setting.PaddleProductId = originalProductID
		setting.PaddleCurrency = originalCurrency
		setting.PaddleUnitPrice = originalUnitPrice
		setting.PaddleMinTopUp = originalMinTopUp
	})

	setting.PaddleSandbox = false
	setting.PaddleApiKey = testPaddleLiveAPIKey
	setting.PaddleClientToken = testPaddleLiveClientToken
	setting.PaddleProductId = testPaddleProductID
	setting.PaddleCurrency = "USD"
	setting.PaddleUnitPrice = 1
	setting.PaddleMinTopUp = 1

	setting.PaddleWebhookSecret = "ntfset_" + testPaddleWebhookSettingID
	require.False(t, isPaddleWebhookConfigured())
	require.False(t, isPaddleTopUpEnabled())

	setting.PaddleWebhookSecret = testPaddleWebhookSecret
	require.True(t, isPaddleWebhookConfigured())
	require.True(t, isPaddleTopUpEnabled())
}

func TestPaddleTopUpEnabledRequiresPositivePricing(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalAPIKey := setting.PaddleApiKey
	originalClientToken := setting.PaddleClientToken
	originalWebhookSecret := setting.PaddleWebhookSecret
	originalSandbox := setting.PaddleSandbox
	originalProductID := setting.PaddleProductId
	originalCurrency := setting.PaddleCurrency
	originalUnitPrice := setting.PaddleUnitPrice
	originalMinTopUp := setting.PaddleMinTopUp
	t.Cleanup(func() {
		setting.PaddleApiKey = originalAPIKey
		setting.PaddleClientToken = originalClientToken
		setting.PaddleWebhookSecret = originalWebhookSecret
		setting.PaddleSandbox = originalSandbox
		setting.PaddleProductId = originalProductID
		setting.PaddleCurrency = originalCurrency
		setting.PaddleUnitPrice = originalUnitPrice
		setting.PaddleMinTopUp = originalMinTopUp
	})

	setting.PaddleSandbox = false
	setting.PaddleApiKey = testPaddleLiveAPIKey
	setting.PaddleClientToken = testPaddleLiveClientToken
	setting.PaddleWebhookSecret = testPaddleWebhookSecret
	setting.PaddleProductId = testPaddleProductID
	setting.PaddleCurrency = "USD"
	setting.PaddleUnitPrice = 1
	setting.PaddleMinTopUp = 1
	require.True(t, isPaddleTopUpEnabled())

	setting.PaddleProductId = "product_example"
	require.False(t, isPaddleTopUpEnabled())
	require.Contains(t, paddleTopUpConfigError(), "pro_")

	setting.PaddleProductId = testPaddleProductID

	setting.PaddleUnitPrice = 0
	require.False(t, isPaddleTopUpEnabled())

	setting.PaddleUnitPrice = 1
	setting.PaddleMinTopUp = 0
	require.False(t, isPaddleTopUpEnabled())

	setting.PaddleMinTopUp = 1
	setting.PaddleCurrency = ""
	require.False(t, isPaddleTopUpEnabled())

	setting.PaddleCurrency = "US"
	require.False(t, isPaddleTopUpEnabled())
	require.Contains(t, paddleTopUpConfigError(), "ISO 4217")

	setting.PaddleCurrency = "usd"
	require.True(t, isPaddleTopUpEnabled())
}
