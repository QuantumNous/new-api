package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func isPaymentComplianceConfirmed() bool {
	return operation_setting.IsPaymentComplianceConfirmed()
}

func isStripeTopUpEnabled() bool {
	return setting.WalletOnlinePaymentEnabled && isPaymentComplianceConfirmed() && isStripeConfigured()
}

func isStripeConfigured() bool {
	return strings.TrimSpace(setting.StripeApiSecret) != "" &&
		strings.TrimSpace(setting.StripeWebhookSecret) != "" &&
		strings.TrimSpace(setting.StripePriceId) != ""
}

func isStripeWebhookConfigured() bool {
	return strings.TrimSpace(setting.StripeWebhookSecret) != ""
}

func isStripeWebhookEnabled() bool {
	return isPaymentComplianceConfirmed() && isStripeConfigured()
}

func isCreemTopUpEnabled() bool {
	return setting.WalletOnlinePaymentEnabled && isPaymentComplianceConfirmed() && isCreemConfigured()
}

func isCreemConfigured() bool {
	products := strings.TrimSpace(setting.CreemProducts)
	return strings.TrimSpace(setting.CreemApiKey) != "" &&
		products != "" &&
		products != "[]"
}

func isCreemWebhookConfigured() bool {
	return strings.TrimSpace(setting.CreemWebhookSecret) != ""
}

func isCreemWebhookEnabled() bool {
	return isPaymentComplianceConfirmed() && isCreemWebhookConfigured() && isCreemConfigured()
}

func isWaffoTopUpEnabled() bool {
	if !setting.WalletOnlinePaymentEnabled || !isPaymentComplianceConfirmed() {
		return false
	}
	if !setting.WaffoEnabled {
		return false
	}

	return isWaffoWebhookConfigured()
}

func isWaffoWebhookConfigured() bool {
	if setting.WaffoSandbox {
		return strings.TrimSpace(setting.WaffoSandboxApiKey) != "" &&
			strings.TrimSpace(setting.WaffoSandboxPrivateKey) != "" &&
			strings.TrimSpace(setting.WaffoSandboxPublicCert) != ""
	}

	return strings.TrimSpace(setting.WaffoApiKey) != "" &&
		strings.TrimSpace(setting.WaffoPrivateKey) != "" &&
		strings.TrimSpace(setting.WaffoPublicCert) != ""
}

func isWaffoWebhookEnabled() bool {
	return isPaymentComplianceConfirmed() && setting.WaffoEnabled && isWaffoWebhookConfigured()
}

func isWaffoPancakeTopUpEnabled() bool {
	if !setting.WalletOnlinePaymentEnabled || !isPaymentComplianceConfirmed() {
		return false
	}
	return isWaffoPancakeWebhookConfigured()
}

func isWaffoPancakeWebhookConfigured() bool {
	// Presence-of-credentials = configured. Webhook processing intentionally
	// does not depend on WalletOnlinePaymentEnabled so delayed notifications for
	// orders created before a shutdown can still be verified and settled.
	return strings.TrimSpace(setting.WaffoPancakeMerchantID) != "" &&
		strings.TrimSpace(setting.WaffoPancakePrivateKey) != "" &&
		strings.TrimSpace(setting.WaffoPancakeStoreID) != "" &&
		strings.TrimSpace(setting.WaffoPancakeTopUpProduct100ID) != "" &&
		strings.TrimSpace(setting.WaffoPancakeTopUpProduct500ID) != "" &&
		strings.TrimSpace(setting.WaffoPancakeTopUpProduct1000ID) != ""
}

func isWaffoPancakeWebhookEnabled() bool {
	return isPaymentComplianceConfirmed() && isWaffoPancakeWebhookConfigured()
}

func isEpayTopUpEnabled() bool {
	if !setting.WalletOnlinePaymentEnabled || !isPaymentComplianceConfirmed() {
		return false
	}
	return isEpayWebhookConfigured() && len(operation_setting.PayMethods) > 0
}

func isEpayWebhookConfigured() bool {
	return strings.TrimSpace(operation_setting.PayAddress) != "" &&
		strings.TrimSpace(operation_setting.EpayId) != "" &&
		strings.TrimSpace(operation_setting.EpayKey) != ""
}

func isEpayWebhookEnabled() bool {
	return isPaymentComplianceConfirmed() && isEpayWebhookConfigured() && len(operation_setting.PayMethods) > 0
}
