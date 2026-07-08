package setting

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

var StripeApiSecret = ""

// StripePublishableKey is the client-side (pk_...) key. When set, the console can
// render Stripe Checkout in embedded mode on our own domain instead of redirecting
// to checkout.stripe.com; when empty, checkout falls back to the hosted redirect.
var StripePublishableKey = ""
var StripeWebhookSecret = ""
var StripePriceId = ""
var StripePriceId20 = ""
var StripePriceId200 = ""
var StripeTopUpPriceIds = ""
var StripeUnitPrice = 8.0
var StripeMinTopUp = 1

// StripeTopUpPriceIDForAmount resolves the multi-currency Stripe Price ID for
// a wallet top-up preset amount. The JSON map is the current source of truth;
// the three legacy fields remain as a migration fallback for existing installs.
func StripeTopUpPriceIDForAmount(amount int64) string {
	if strings.TrimSpace(StripeTopUpPriceIds) != "" {
		priceIds := parseStripeTopUpPriceIds(StripeTopUpPriceIds)
		return strings.TrimSpace(priceIds[amount])
	}

	switch amount {
	case 10:
		return strings.TrimSpace(StripePriceId)
	case 20:
		return strings.TrimSpace(StripePriceId20)
	case 200:
		return strings.TrimSpace(StripePriceId200)
	default:
		return ""
	}
}

func parseStripeTopUpPriceIds(raw string) map[int64]string {
	result := map[int64]string{}
	var parsed map[string]string
	if err := common.UnmarshalJsonStr(strings.TrimSpace(raw), &parsed); err != nil {
		return result
	}
	for key, value := range parsed {
		amount, err := strconv.ParseInt(strings.TrimSpace(key), 10, 64)
		if err != nil || amount <= 0 {
			continue
		}
		result[amount] = strings.TrimSpace(value)
	}
	return result
}

// --- Card binding (SetupIntent postpaid) ---

// StripeCardBindEnabled is the master switch for the card-binding onboarding flow.
// Defaults to true so every new user sees the recharge-promo onboarding without an admin
// having to flip a setting. When false: no onboarding redirect, no banner, no $10 bonus.
var StripeCardBindEnabled = true

// StripeAutoChargeEnabled toggles threshold-triggered automatic off-session charging.
var StripeAutoChargeEnabled = false

// StripeAutoChargeThreshold is the balance (in topup units / USD) below which an
// automatic charge is triggered for users with a bound card.
var StripeAutoChargeThreshold = 2

// StripeAutoChargeAmount is the USD amount (in topup units) charged each time an
// automatic top-up fires.
var StripeAutoChargeAmount = 20

// StripeNewUserBonusAmount is the USD amount (in topup units) granted once when a
// user binds their first card.
var StripeNewUserBonusAmount = 10
