package setting

// Waffo Pancake hosted checkout configuration. Gateway is enabled once
// MerchantID + PrivateKey + ProductID are populated (no separate Enabled
// flag, matching Stripe / Creem). StoreID + ProductID are operator-bound
// via SaveWaffoPancakeConfig.
var (
	WaffoPancakeMerchantID string
	WaffoPancakePrivateKey string
	WaffoPancakeReturnURL  string
	WaffoPancakeCurrency   string  = "CNY"
	WaffoPancakeUnitPrice  float64 = 1.0
	WaffoPancakeMinTopUp   int     = 1000
	WaffoPancakeStoreID    string
	// WaffoPancakeProductID is retained for existing generic and subscription
	// flows. Wallet top-ups use the three fixed CNY product IDs below.
	WaffoPancakeProductID          string
	WaffoPancakeTopUpProduct100ID  string
	WaffoPancakeTopUpProduct500ID  string
	WaffoPancakeTopUpProduct1000ID string
)
