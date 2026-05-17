package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func isPaymentComplianceConfirmed() bool {
	return operation_setting.IsPaymentComplianceConfirmed()
}

func isPaymentProviderAvailableForScene(provider string, scene string, configured bool) bool {
	return isPaymentComplianceConfirmed() &&
		configured &&
		operation_setting.IsPaymentProviderAllowedForScene(provider, scene)
}

func isStripeTopUpConfigured() bool {
	return strings.TrimSpace(setting.StripeApiSecret) != "" &&
		strings.TrimSpace(setting.StripeWebhookSecret) != "" &&
		strings.TrimSpace(setting.StripePriceId) != ""
}

func isStripeSubscriptionConfigured() bool {
	return strings.TrimSpace(setting.StripeApiSecret) != "" &&
		strings.TrimSpace(setting.StripeWebhookSecret) != ""
}

func isStripeTopUpEnabled() bool {
	return isPaymentProviderAvailableForScene(
		operation_setting.PaymentProviderStripe,
		operation_setting.PaymentSceneWalletTopUp,
		isStripeTopUpConfigured(),
	)
}

func isStripeSubscriptionEnabled() bool {
	return isPaymentProviderAvailableForScene(
		operation_setting.PaymentProviderStripe,
		operation_setting.PaymentSceneSubscriptionPurchase,
		isStripeSubscriptionConfigured(),
	)
}

func isStripeWebhookConfigured() bool {
	return strings.TrimSpace(setting.StripeWebhookSecret) != ""
}

func isStripeWebhookEnabled() bool {
	return isPaymentComplianceConfirmed() && isStripeWebhookConfigured()
}

func isCreemTopUpConfigured() bool {
	products := strings.TrimSpace(setting.CreemProducts)
	return strings.TrimSpace(setting.CreemApiKey) != "" &&
		isCreemWebhookConfigured() &&
		products != "" &&
		products != "[]"
}

func isCreemSubscriptionConfigured() bool {
	return strings.TrimSpace(setting.CreemApiKey) != "" && isCreemWebhookConfigured()
}

func isCreemTopUpEnabled() bool {
	return isPaymentProviderAvailableForScene(
		operation_setting.PaymentProviderCreem,
		operation_setting.PaymentSceneWalletTopUp,
		isCreemTopUpConfigured(),
	)
}

func isCreemSubscriptionEnabled() bool {
	return isPaymentProviderAvailableForScene(
		operation_setting.PaymentProviderCreem,
		operation_setting.PaymentSceneSubscriptionPurchase,
		isCreemSubscriptionConfigured(),
	)
}

func isCreemWebhookConfigured() bool {
	return setting.CreemTestMode || strings.TrimSpace(setting.CreemWebhookSecret) != ""
}

func isCreemWebhookEnabled() bool {
	return isPaymentComplianceConfirmed() && isCreemWebhookConfigured()
}

func isWaffoConfigured() bool {
	if !setting.WaffoEnabled {
		return false
	}
	if setting.WaffoSandbox {
		return strings.TrimSpace(setting.WaffoSandboxApiKey) != "" &&
			strings.TrimSpace(setting.WaffoSandboxPrivateKey) != "" &&
			strings.TrimSpace(setting.WaffoSandboxPublicCert) != ""
	}
	return strings.TrimSpace(setting.WaffoApiKey) != "" &&
		strings.TrimSpace(setting.WaffoPrivateKey) != "" &&
		strings.TrimSpace(setting.WaffoPublicCert) != ""
}

func isWaffoTopUpEnabled() bool {
	return isPaymentProviderAvailableForScene(
		operation_setting.PaymentProviderWaffo,
		operation_setting.PaymentSceneWalletTopUp,
		isWaffoConfigured(),
	)
}

func isWaffoWebhookConfigured() bool {
	return isWaffoConfigured()
}

func isWaffoWebhookEnabled() bool {
	return isPaymentComplianceConfirmed() && isWaffoWebhookConfigured()
}

func isWaffoPancakeTopUpConfigured() bool {
	return setting.WaffoPancakeEnabled &&
		isWaffoPancakeWebhookConfigured() &&
		strings.TrimSpace(setting.WaffoPancakeMerchantID) != "" &&
		strings.TrimSpace(setting.WaffoPancakePrivateKey) != "" &&
		strings.TrimSpace(setting.WaffoPancakeStoreID) != "" &&
		strings.TrimSpace(setting.WaffoPancakeProductID) != ""
}

func isWaffoPancakeTopUpEnabled() bool {
	return isPaymentProviderAvailableForScene(
		operation_setting.PaymentProviderWaffoPancake,
		operation_setting.PaymentSceneWalletTopUp,
		isWaffoPancakeTopUpConfigured(),
	)
}

func isWaffoPancakeWebhookConfigured() bool {
	currentWebhookKey := strings.TrimSpace(setting.WaffoPancakeWebhookPublicKey)
	if setting.WaffoPancakeSandbox {
		currentWebhookKey = strings.TrimSpace(setting.WaffoPancakeWebhookTestKey)
	}
	return setting.WaffoPancakeEnabled && currentWebhookKey != ""
}

func isWaffoPancakeWebhookEnabled() bool {
	return isPaymentComplianceConfirmed() && isWaffoPancakeWebhookConfigured()
}

func isEpayConfigured() bool {
	return strings.TrimSpace(operation_setting.PayAddress) != "" &&
		strings.TrimSpace(operation_setting.EpayId) != "" &&
		strings.TrimSpace(operation_setting.EpayKey) != ""
}

func isEpayTopUpConfigured() bool {
	return isEpayConfigured() && len(operation_setting.PayMethods) > 0
}

func isEpaySubscriptionConfigured() bool {
	return isEpayConfigured() && len(operation_setting.PayMethods) > 0
}

func isEpayTopUpEnabled() bool {
	return isPaymentProviderAvailableForScene(
		operation_setting.PaymentProviderEpay,
		operation_setting.PaymentSceneWalletTopUp,
		isEpayTopUpConfigured(),
	)
}

func isEpaySubscriptionEnabled() bool {
	return isPaymentProviderAvailableForScene(
		operation_setting.PaymentProviderEpay,
		operation_setting.PaymentSceneSubscriptionPurchase,
		isEpaySubscriptionConfigured(),
	)
}

func isEpayWebhookConfigured() bool {
	return isEpayConfigured()
}

func isEpayWebhookEnabled() bool {
	return isPaymentComplianceConfirmed() && isEpayWebhookConfigured()
}
