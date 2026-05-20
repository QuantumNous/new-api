package setting

// Airwallex hosted-payment-page integration.
//
// Mirrors the Stripe pattern (RequestPay → hosted checkout → webhook → credit
// quota) but uses Airwallex's PaymentIntent API. AUD is the first-class
// currency; AirwallexCurrencies declares the additional currencies the admin
// has enabled, each with its own unit price + min topup so quota conversion
// stays explicit per currency instead of relying on an opaque FX rate.
var (
	AirwallexEnabled       = false
	AirwallexSandbox       = true
	AirwallexClientId      = ""
	AirwallexApiKey        = ""
	AirwallexWebhookSecret = ""

	// AirwallexCurrencies is a JSON array describing every currency the
	// operator wants to expose at /wallet. Shape:
	//   [{"currency":"AUD","unit_price":1.5,"min_topup":5},
	//    {"currency":"USD","unit_price":1.0,"min_topup":5}, ...]
	// unit_price is "currency units per 1 quota unit" (matches StripeUnitPrice
	// semantics). Frontend reads this list, picks the default (first entry),
	// and shows a currency switcher above the amount input.
	AirwallexCurrencies = `[{"currency":"AUD","unit_price":1.5,"min_topup":5},{"currency":"USD","unit_price":1.0,"min_topup":5}]`

	// Optional return URLs. If empty, controller falls back to ServerAddress.
	AirwallexReturnUrl = ""
	AirwallexCancelUrl = ""
)

const (
	AirwallexApiBaseProd    = "https://api.airwallex.com"
	AirwallexApiBaseSandbox = "https://api-demo.airwallex.com"
)

// AirwallexApiBaseURL returns the API host matching the current sandbox flag.
func AirwallexApiBaseURL() string {
	if AirwallexSandbox {
		return AirwallexApiBaseSandbox
	}
	return AirwallexApiBaseProd
}
