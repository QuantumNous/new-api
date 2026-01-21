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

func init() {
	StripeManagedPaymentsEnabled = common.GetEnvOrDefaultBool("STRIPE_MANAGED_PAYMENTS_ENABLED", false)
}
