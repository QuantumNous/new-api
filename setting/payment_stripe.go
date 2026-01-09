package setting

import (
	"github.com/QuantumNous/new-api/common"
)

var StripeApiSecret = ""
var StripeWebhookSecret = ""
var StripePriceId = ""
var StripeUnitPrice = 8.0
var StripeMinTopUp = 1
var StripePromotionCodesEnabled = false
var StripeManagedPaymentsEnabled = false
var StripeAutoTaxEnabled = false

func init() {
	StripeManagedPaymentsEnabled = common.GetEnvOrDefaultBool("STRIPE_MANAGED_PAYMENTS_ENABLED", true)
	StripeAutoTaxEnabled = common.GetEnvOrDefaultBool("STRIPE_AUTO_TAX_ENABLED", true)
}
