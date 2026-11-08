package billing

import (
	"fmt"
	"strings"
	"github.com/QuantumNous/new-api/internal/usage"
	"math"
	"strconv"

	"github.com/QuantumNous/new-api/internal/billing/price_expression"
	catalog "github.com/QuantumNous/new-api/internal/catalog"
	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/identity"
	"github.com/QuantumNous/new-api/internal/logger"
	"github.com/QuantumNous/new-api/internal/settings"
)

// Payment option seeding and application live here, not in internal/settings:
// settings owns only the generic option storage/load/config mechanism, so it
// must not import this domain. Registration follows the same nil-safe hook-var
// convention the catalog domain already uses (see catalog/resolve_group.go).
func seedPaymentOptions() map[string]string {
	return map[string]string{
		"Price":                       strconv.FormatFloat(Price, 'f', -1, 64),
		"USDExchangeRate":             strconv.FormatFloat(USDExchangeRate, 'f', -1, 64),
		"MinTopUp":                    strconv.Itoa(MinTopUp),
		"StripeMinTopUp":              strconv.Itoa(StripeMinTopUp),
		"StripeApiSecret":             StripeApiSecret,
		"StripeWebhookSecret":         StripeWebhookSecret,
		"StripePriceId":               StripePriceId,
		"StripeUnitPrice":             strconv.FormatFloat(StripeUnitPrice, 'f', -1, 64),
		"StripePromotionCodesEnabled": strconv.FormatBool(StripePromotionCodesEnabled),
		"CreemApiKey":                 CreemApiKey,
		"CreemProducts":               CreemProducts,
		"CreemTestMode":               strconv.FormatBool(CreemTestMode),
		"CreemWebhookSecret":          CreemWebhookSecret,
		"WaffoEnabled":                strconv.FormatBool(WaffoEnabled),
		"WaffoApiKey":                 WaffoApiKey,
		"WaffoPrivateKey":             WaffoPrivateKey,
		"WaffoPublicCert":             WaffoPublicCert,
		"WaffoSandboxPublicCert":      WaffoSandboxPublicCert,
		"WaffoSandboxApiKey":          WaffoSandboxApiKey,
		"WaffoSandboxPrivateKey":      WaffoSandboxPrivateKey,
		"WaffoSandbox":                strconv.FormatBool(WaffoSandbox),
		"WaffoMerchantId":             WaffoMerchantId,
		"WaffoNotifyUrl":              WaffoNotifyUrl,
		"WaffoReturnUrl":              WaffoReturnUrl,
		"WaffoSubscriptionReturnUrl":  WaffoSubscriptionReturnUrl,
		"WaffoCurrency":               WaffoCurrency,
		"WaffoUnitPrice":              strconv.FormatFloat(WaffoUnitPrice, 'f', -1, 64),
		"WaffoMinTopUp":               strconv.Itoa(WaffoMinTopUp),
		"WaffoPayMethods":             "[]",
		"WaffoPancakeMerchantID":      WaffoPancakeMerchantID,
		"WaffoPancakePrivateKey":      WaffoPancakePrivateKey,
		"WaffoPancakeReturnURL":       WaffoPancakeReturnURL,
		"WaffoPancakeStoreID":         WaffoPancakeStoreID,
		"WaffoPancakeProductID":       WaffoPancakeProductID,
		"WaffoPancakeUnitPrice":       strconv.FormatFloat(WaffoPancakeUnitPrice, 'f', -1, 64),
		"WaffoPancakeMinTopUp":        strconv.Itoa(WaffoPancakeMinTopUp),
		"PayMethods":                  PayMethods2JsonString(),
		"VmqAddress":                  VmqAddress,
		"VmqKey":                      VmqKey,
		"CodePayAddress":              CodePayAddress,
		"CodePayId":                   CodePayId,
		"CodePayKey":                  CodePayKey,
	}
}

func applyPaymentOption(key, value string) error {
	switch key {
	case "PayAddress":
		PayAddress = value
	case "CustomCallbackAddress":
		CustomCallbackAddress = value
	case "EpayId":
		EpayId = value
	case "EpayKey":
		EpayKey = value
	case "Price":
		Price, _ = strconv.ParseFloat(value, 64)
	case "USDExchangeRate":
		USDExchangeRate, _ = strconv.ParseFloat(value, 64)
	case "MinTopUp":
		MinTopUp, _ = strconv.Atoi(value)
	case "StripeApiSecret":
		StripeApiSecret = value
	case "StripeWebhookSecret":
		StripeWebhookSecret = value
	case "StripePriceId":
		StripePriceId = value
	case "StripeUnitPrice":
		StripeUnitPrice, _ = strconv.ParseFloat(value, 64)
	case "StripeMinTopUp":
		StripeMinTopUp, _ = strconv.Atoi(value)
	case "StripePromotionCodesEnabled":
		StripePromotionCodesEnabled = value == "true"
	case "CreemApiKey":
		CreemApiKey = value
	case "CreemProducts":
		CreemProducts = value
	case "CreemTestMode":
		CreemTestMode = value == "true"
	case "CreemWebhookSecret":
		CreemWebhookSecret = value
	case "WaffoEnabled":
		WaffoEnabled = value == "true"
	case "WaffoApiKey":
		WaffoApiKey = value
	case "WaffoPrivateKey":
		WaffoPrivateKey = value
	case "WaffoPublicCert":
		WaffoPublicCert = value
	case "WaffoSandboxPublicCert":
		WaffoSandboxPublicCert = value
	case "WaffoSandboxApiKey":
		WaffoSandboxApiKey = value
	case "WaffoSandboxPrivateKey":
		WaffoSandboxPrivateKey = value
	case "WaffoSandbox":
		WaffoSandbox = value == "true"
	case "WaffoMerchantId":
		WaffoMerchantId = value
	case "WaffoNotifyUrl":
		WaffoNotifyUrl = value
	case "WaffoReturnUrl":
		WaffoReturnUrl = value
	case "WaffoSubscriptionReturnUrl":
		WaffoSubscriptionReturnUrl = value
	case "WaffoCurrency":
		WaffoCurrency = value
	case "WaffoUnitPrice":
		WaffoUnitPrice, _ = strconv.ParseFloat(value, 64)
	case "WaffoMinTopUp":
		WaffoMinTopUp, _ = strconv.Atoi(value)
	case "WaffoPancakeMerchantID":
		WaffoPancakeMerchantID = value
	case "WaffoPancakePrivateKey":
		WaffoPancakePrivateKey = value
	case "WaffoPancakeReturnURL":
		WaffoPancakeReturnURL = value
	case "WaffoPancakeStoreID":
		WaffoPancakeStoreID = value
	case "WaffoPancakeProductID":
		WaffoPancakeProductID = value
	case "WaffoPancakeUnitPrice":
		WaffoPancakeUnitPrice, _ = strconv.ParseFloat(value, 64)
	case "WaffoPancakeMinTopUp":
		WaffoPancakeMinTopUp, _ = strconv.Atoi(value)
	case "VmqAddress":
		VmqAddress = value
	case "VmqKey":
		VmqKey = value
	case "CodePayAddress":
		CodePayAddress = value
	case "CodePayId":
		CodePayId = value
	case "CodePayKey":
		CodePayKey = value
	case "PayMethods":
		return UpdatePayMethodsByJsonString(value)
	}
	return nil
}

// QuotaToDisplayAmount converts an internal quota integer to the amount in
// the site's configured display currency. This is the single API-boundary
// implementation of the quota -> display rule; formatQuota and every
// `_display` JSON field go through it, so the number the frontend renders can
// never drift from the one the log line renders.
//
// TOKENS returns the raw quota unchanged: the display value IS the token count.
// USD divides by QuotaPerUnit, CNY additionally multiplies by the USD->CNY rate,
// CUSTOM multiplies by the admin-configured custom rate (<=0 falls back to 1).
func QuotaToDisplayAmount(quota int) float64 {
	q := float64(quota)
	switch GetQuotaDisplayType() {
	case QuotaDisplayTypeCNY:
		return q / common.QuotaPerUnit * USDExchangeRate
	case QuotaDisplayTypeCustom:
		rate := GetGeneralSetting().CustomCurrencyExchangeRate
		if rate <= 0 {
			rate = 1
		}
		return q / common.QuotaPerUnit * rate
	case QuotaDisplayTypeTokens:
		return q
	default: // USD
		return q / common.QuotaPerUnit
	}
}

// QuotaToDisplayAmount64 is the int64 variant, saturating to the int32 range
// before delegating so int64 subscription amounts can never overflow the
// 32-bit quota columns when rendered.
func QuotaToDisplayAmount64(quota int64) float64 {
	if quota > math.MaxInt32 {
		return QuotaToDisplayAmount(math.MaxInt32)
	}
	if quota < math.MinInt32 {
		return QuotaToDisplayAmount(math.MinInt32)
	}
	return QuotaToDisplayAmount(int(quota))
}

// QuotaFromDisplayAmount is the inverse of QuotaToDisplayAmount: it takes a
// amount submitted in the site's display currency and returns internal quota.
// It is what form endpoints use instead of letting the browser pre-convert.
// Rounding goes through common.QuotaRound, so a non-finite or oversized
// submission saturates at the int32 boundary instead of wrapping into a
// credit; callers reject NaN/Inf input with HTTP 400 before reaching this.
func QuotaFromDisplayAmount(displayAmount float64) int {
	// Non-finite submissions never reach a valid quota. NaN saturates to 0 and
	// -Inf to MinQuota (a negative charge), both violating the billing
	// invariant; callers reject them with HTTP 400, and this guard keeps the
	// helper safe even when a path forgets to check.
	if math.IsNaN(displayAmount) || math.IsInf(displayAmount, 0) {
		return 0
	}
	switch GetQuotaDisplayType() {
	case QuotaDisplayTypeCNY:
		return common.QuotaRound(displayAmount / USDExchangeRate * common.QuotaPerUnit)
	case QuotaDisplayTypeCustom:
		rate := GetGeneralSetting().CustomCurrencyExchangeRate
		if rate <= 0 {
			rate = 1
		}
		return common.QuotaRound(displayAmount / rate * common.QuotaPerUnit)
	case QuotaDisplayTypeTokens:
		return common.QuotaRound(displayAmount)
	default: // USD
		return common.QuotaRound(displayAmount * common.QuotaPerUnit)
	}
}

// UsdToDisplayAmount converts a USD-scale amount (top-up order amounts, wallet
// balances) to the site's display currency. It is the numeric core of the
// frontend's formatCurrencyFromUSD: TOKENS multiplies back by QuotaPerUnit to
// recover the token count, the currency modes apply the exchange rate.
func UsdToDisplayAmount(usd float64) float64 {
	switch GetQuotaDisplayType() {
	case QuotaDisplayTypeTokens:
		return usd * common.QuotaPerUnit
	default:
		return usd * GetUsdToCurrencyRate(USDExchangeRate)
	}
}

// rejectNonFiniteDisplayAmount reports whether a form-submitted display amount
// is NaN or +/-Inf. JSON cannot encode either, but a client can send an
// exponent that overflows float64, and that must not reach QuotaRound: an
// overflowed amount would clamp to MaxQuota and silently create a huge
// redemption. Callers answer HTTP 400 when this fires.
func rejectNonFiniteDisplayAmount(amount float64) bool {
	return math.IsNaN(amount) || math.IsInf(amount, 0)
}

// formatQuota carries the display-type rendering that used to live in
// internal/logger. logger owns no billing settings, so this domain registers it.
func formatQuota(quota int, withUnitSuffix bool) string {
	suffix := ""
	if withUnitSuffix {
		suffix = " 额度"
	}
	amount := QuotaToDisplayAmount(quota)
	switch GetQuotaDisplayType() {
	case QuotaDisplayTypeCNY:
		return fmt.Sprintf("¥%.6f%s", amount, suffix)
	case QuotaDisplayTypeCustom:
		symbol := GetGeneralSetting().CustomCurrencySymbol
		if symbol == "" {
			symbol = "¤"
		}
		return fmt.Sprintf("%s%.6f%s", symbol, amount, suffix)
	case QuotaDisplayTypeTokens:
		if withUnitSuffix {
			return fmt.Sprintf("%d 点额度", quota)
		}
		return fmt.Sprintf("%d", quota)
	default: // USD
		return fmt.Sprintf("＄%.6f%s", amount, suffix)
	}
}

// validateTieredBillingOption rejects billing_setting.* payloads whose JSON
// shape is wrong or whose expressions cannot compile. Syntax problems must be
// caught at save time: GetBillingMode/GetBillingExpr only do exact map lookups
// at request time, so a malformed entry would otherwise silently fall back to
// ratio billing or fail the request mid-billing. An empty expression string is
// accepted (treated as unset for that model).
func validateTieredBillingOption(key, value string) error {
	switch key {
	case "billing_setting.billing_mode":
		modes := map[string]string{}
		if err := common.Unmarshal([]byte(value), &modes); err != nil {
			return fmt.Errorf("billing_setting.billing_mode 必须是 {模型: 模式} 形式的 JSON: %w", err)
		}
		for model, mode := range modes {
			if mode != BillingModeRatio && mode != BillingModeTieredExpr {
				return fmt.Errorf("billing_setting.billing_mode[%s]: 未知计费模式 %q（仅支持 ratio / tiered_expr）", model, mode)
			}
		}
	case "billing_setting.billing_expr":
		exprs := map[string]string{}
		if err := common.Unmarshal([]byte(value), &exprs); err != nil {
			return fmt.Errorf("billing_setting.billing_expr 必须是 {模型: 表达式} 形式的 JSON: %w", err)
		}
		for model, exprStr := range exprs {
			if strings.TrimSpace(exprStr) == "" {
				continue
			}
			if _, err := price_expression.CompileFromCache(exprStr); err != nil {
				return fmt.Errorf("billing_setting.billing_expr[%s] 表达式无法编译: %w", model, err)
			}
		}
	}
	return nil
}

func init() {
	settings.OnSeedPaymentOptions = seedPaymentOptions
	settings.OnApplyPaymentOption = applyPaymentOption

	settings.OnValidateTieredBillingOption = validateTieredBillingOption

	settings.OnIsToolPriceOptionKey = func(key string) bool {
		return key == price_expression.ToolPriceOptionKey
	}
	settings.OnValidateToolPriceOption = price_expression.ValidateToolPricesJSON
	settings.OnApplyToolPriceOption = price_expression.LoadToolPricesFromJSONString

	logger.OnFormatQuota = formatQuota
	identity.OnQuotaToDisplayAmount = QuotaToDisplayAmount
	identity.OnQuotaFromDisplayAmount = QuotaFromDisplayAmount
	usage.OnQuotaToDisplayAmount = QuotaToDisplayAmount
	catalog.OnQuotaToDisplayAmount = QuotaToDisplayAmount
	identity.OnIsPaymentComplianceConfirmed = IsPaymentComplianceConfirmed

	catalog.OnResolveTieredBilling = func(model string) (string, string, bool) {
		mode := GetBillingMode(model)
		if mode != BillingModeTieredExpr {
			return "", "", false
		}
		expr, ok := GetBillingExpr(model)
		return mode, expr, ok
	}
}
