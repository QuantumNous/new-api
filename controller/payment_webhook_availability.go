package controller

import (
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

var (
	paddleSandboxAPIKeyPattern = regexp.MustCompile(`^pdl_sdbx_apikey_[a-z\d]{26}_[a-zA-Z\d]{22}_[a-zA-Z\d]{3}$`)
	paddleLiveAPIKeyPattern    = regexp.MustCompile(`^pdl_live_apikey_[a-z\d]{26}_[a-zA-Z\d]{22}_[a-zA-Z\d]{3}$`)
	paddleSandboxTokenPattern  = regexp.MustCompile(`^test_[a-zA-Z\d]{27}$`)
	paddleLiveTokenPattern     = regexp.MustCompile(`^live_[a-zA-Z\d]{27}$`)
	paddleProductIDPattern     = regexp.MustCompile(`^pro_[a-z\d]{26}$`)
	paddleWebhookSecretPattern = regexp.MustCompile(`^pdl_ntfset_[a-zA-Z\d]{26}_[a-zA-Z\d]{32}$`)
	paddleCurrencyPattern      = regexp.MustCompile(`^[A-Z]{3}$`)
)

func isPaymentComplianceConfirmed() bool {
	return operation_setting.IsPaymentComplianceConfirmed()
}

func isStripeTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	return strings.TrimSpace(setting.StripeApiSecret) != "" &&
		strings.TrimSpace(setting.StripeWebhookSecret) != "" &&
		strings.TrimSpace(setting.StripePriceId) != ""
}

func isStripeWebhookConfigured() bool {
	return strings.TrimSpace(setting.StripeWebhookSecret) != ""
}

func isStripeWebhookEnabled() bool {
	return isStripeTopUpEnabled()
}

func isCreemTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	products := strings.TrimSpace(setting.CreemProducts)
	return strings.TrimSpace(setting.CreemApiKey) != "" &&
		products != "" &&
		products != "[]"
}

func isCreemWebhookConfigured() bool {
	return strings.TrimSpace(setting.CreemWebhookSecret) != ""
}

func isCreemWebhookEnabled() bool {
	return isCreemTopUpEnabled() && isCreemWebhookConfigured()
}

func isWaffoTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
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
	return isWaffoTopUpEnabled()
}

func isWaffoPancakeTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	// Presence-of-credentials = enabled. Webhook public keys ship inside
	// the SDK; mode (test/prod) is read from each event.
	return strings.TrimSpace(setting.WaffoPancakeMerchantID) != "" &&
		strings.TrimSpace(setting.WaffoPancakePrivateKey) != "" &&
		strings.TrimSpace(setting.WaffoPancakeProductID) != ""
}

func isWaffoPancakeWebhookConfigured() bool {
	return isWaffoPancakeTopUpEnabled()
}

func isWaffoPancakeWebhookEnabled() bool {
	return isWaffoPancakeTopUpEnabled()
}

func isPaddleTopUpEnabled() bool {
	return paddleTopUpConfigError() == ""
}

func paddleTopUpConfigError() string {
	if !isPaymentComplianceConfirmed() {
		return "支付合规确认未完成"
	}
	if !isPaddleAPIKeyConfigured() {
		if setting.PaddleSandbox {
			return "Paddle API key 与沙盒环境不匹配，应使用完整 pdl_sdbx_apikey_..._..._... 形态"
		}
		return "Paddle API key 与正式环境不匹配，应使用完整 pdl_live_apikey_..._..._... 形态"
	}
	if !isPaddleClientTokenConfigured() {
		if setting.PaddleSandbox {
			return "Paddle client-side token 与沙盒环境不匹配，应使用完整 test_... 形态"
		}
		return "Paddle client-side token 与正式环境不匹配，应使用完整 live_... 形态"
	}
	if !isPaddleWebhookSecretConfigured() {
		return "Paddle webhook secret 必须使用完整 endpoint signing secret pdl_ntfset_..._...，不能使用 notification setting id ntfset_..."
	}
	if !isPaddleProductIDConfigured() {
		return "Paddle product id 与 Paddle 产品 ID 形态不匹配，应使用完整 pro_... 形态"
	}
	if !isPaddleCurrencyConfigured() {
		return "Paddle currency 必须是 3 位 ISO 4217 币种代码"
	}
	if setting.PaddleUnitPrice <= 0 {
		return "Paddle unit price 必须大于 0"
	}
	if setting.PaddleMinTopUp <= 0 {
		return "Paddle min topup 必须大于 0"
	}
	return ""
}

func isPaddleAPIKeyConfigured() bool {
	apiKey := strings.TrimSpace(setting.PaddleApiKey)
	if apiKey == "" {
		return false
	}
	if setting.PaddleSandbox {
		return paddleSandboxAPIKeyPattern.MatchString(apiKey)
	}
	return paddleLiveAPIKeyPattern.MatchString(apiKey)
}

func isPaddleClientTokenConfigured() bool {
	clientToken := strings.TrimSpace(setting.PaddleClientToken)
	if clientToken == "" {
		return false
	}
	if setting.PaddleSandbox {
		return paddleSandboxTokenPattern.MatchString(clientToken)
	}
	return paddleLiveTokenPattern.MatchString(clientToken)
}

func isPaddleProductIDConfigured() bool {
	return paddleProductIDPattern.MatchString(strings.TrimSpace(setting.PaddleProductId))
}

func isPaddleWebhookConfigured() bool {
	return isPaddleWebhookSecretConfigured()
}

func isPaddleWebhookEnabled() bool {
	return isPaddleWebhookConfigured()
}

func isPaddleWebhookSecretConfigured() bool {
	secret := strings.TrimSpace(setting.PaddleWebhookSecret)
	return paddleWebhookSecretPattern.MatchString(secret)
}

func isPaddleCurrencyConfigured() bool {
	currency := strings.ToUpper(strings.TrimSpace(setting.PaddleCurrency))
	return paddleCurrencyPattern.MatchString(currency)
}

func isEpayTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	return isEpayWebhookConfigured() && len(operation_setting.PayMethods) > 0
}

func isOnlineTopUpEnabled() bool {
	return isEpayTopUpEnabled() ||
		isStripeTopUpEnabled() ||
		isCreemTopUpEnabled() ||
		isWaffoTopUpEnabled() ||
		isWaffoPancakeTopUpEnabled() ||
		isPaddleTopUpEnabled()
}

func isEpayWebhookConfigured() bool {
	return strings.TrimSpace(operation_setting.PayAddress) != "" &&
		strings.TrimSpace(operation_setting.EpayId) != "" &&
		strings.TrimSpace(operation_setting.EpayKey) != ""
}

func isEpayWebhookEnabled() bool {
	return isEpayTopUpEnabled()
}
