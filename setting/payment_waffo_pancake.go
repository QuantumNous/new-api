package setting

import "math"

// WaffoPancakeMinUnitPrice is the smallest provider-currency-per-wallet-USD
// rate accepted by the Pancake wallet flow.
const WaffoPancakeMinUnitPrice = 0.0001

// IsValidWaffoPancakeUnitPrice reports whether the forward quote rate can be
// used safely by configuration, availability, and payment calculation paths.
func IsValidWaffoPancakeUnitPrice(unitPrice float64) bool {
	return !math.IsNaN(unitPrice) &&
		!math.IsInf(unitPrice, 0) &&
		unitPrice >= WaffoPancakeMinUnitPrice
}

// Waffo Pancake hosted checkout configuration. Gateway is enabled once
// MerchantID + PrivateKey + ProductID are populated (no separate Enabled
// flag, matching Stripe / Creem). StoreID + ProductID are operator-bound
// via SaveWaffoPancakeConfig.
var (
	WaffoPancakeMerchantID string
	WaffoPancakePrivateKey string
	WaffoPancakeReturnURL  string
	// WaffoPancakeUnitPrice is the configured Pancake currency charged per
	// one wallet USD. Quote group ratios and amount discounts are applied
	// before the configured wallet checkout fees.
	WaffoPancakeUnitPrice float64 = 1.0
	WaffoPancakeMinTopUp  int     = 1
	WaffoPancakeStoreID   string
	WaffoPancakeProductID string
	// WaffoPancakeCurrency is intentionally empty until an administrator selects
	// one. A single-currency product can be resolved safely at checkout; a
	// multi-currency product must have an explicit persisted currency.
	WaffoPancakeCurrency string
)
