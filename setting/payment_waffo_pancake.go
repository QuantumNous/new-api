package setting

// Waffo Pancake hosted checkout configuration.
//
// User-facing fields:
//   - MerchantID + PrivateKey: only credentials the operator pastes from the
//     Pancake dashboard.
//   - ReturnURL / UnitPrice / MinTopUp: pricing + redirect knobs.
//
// Internally-managed fields (populated by service.EnsureWaffoPancakePrimaryProduct
// the first time the operator saves credentials):
//   - StoreID + ProductID: Pancake catalog entities created automatically on
//     behalf of the operator so they never have to think about "what is a
//     Store / Product?".
//   - ProvisionedMerchantID: snapshot of the MerchantID the auto-created
//     store/product belong to, so swapping the credential pair forces a
//     re-provision and prevents stale references.
//
// There is no `Enabled` flag — the gateway is enabled the moment MerchantID
// and PrivateKey are populated, mirroring how Stripe / Creem behave.
var (
	WaffoPancakeMerchantID            string
	WaffoPancakePrivateKey            string
	WaffoPancakeReturnURL             string
	WaffoPancakeUnitPrice             float64 = 1.0
	WaffoPancakeMinTopUp              int     = 1
	WaffoPancakeStoreID               string
	WaffoPancakeProductID             string
	WaffoPancakeProvisionedMerchantID string
	// WaffoPancakeProvisionedReturnURL snapshots the SuccessURL that is
	// currently bound to the auto-created OnetimeProduct. It exists so that
	// EnsureWaffoPancakePrimaryProduct can detect "operator changed the
	// return URL" and push an Update through to Pancake without recreating
	// the product.
	WaffoPancakeProvisionedReturnURL string
)
