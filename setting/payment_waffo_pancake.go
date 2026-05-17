package setting

// Waffo Pancake hosted checkout configuration.
//
// Operator-typed fields (entered through the admin UI):
//   - MerchantID + PrivateKey: credentials pasted from the Pancake dashboard.
//   - ReturnURL: where the buyer lands after checkout.
//   - UnitPrice + MinTopUp: wallet top-up pricing knobs.
//
// Operator-bound fields (picked from the catalog via the admin "Save" flow,
// see service.SaveWaffoPancakeConfig + service.CreateWaffoPancakePrimaryPair):
//   - StoreID + ProductID: the Pancake Store the gateway pins to, plus the
//     OnetimeProduct used for wallet top-ups. Each can either be created
//     fresh through the "+ Create" button or selected from the catalog of
//     existing entities — either way it's the operator who binds them.
//
// There is no `Enabled` flag — the gateway is enabled the moment MerchantID,
// PrivateKey, and ProductID are all populated, mirroring how Stripe / Creem
// behave.
var (
	WaffoPancakeMerchantID string
	WaffoPancakePrivateKey string
	WaffoPancakeReturnURL  string
	WaffoPancakeUnitPrice  float64 = 1.0
	WaffoPancakeMinTopUp   int     = 1
	WaffoPancakeStoreID    string
	WaffoPancakeProductID  string
)
