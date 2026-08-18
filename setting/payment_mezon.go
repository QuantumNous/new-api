package setting

// Mezon đồng (MMN chain) top-up settings.
// Users top up by transferring đồng to the treasury wallet inside the Mezon
// app, then submit the transaction hash; the backend verifies the transfer
// against the public indexer before crediting quota.
var MezonPayment = struct {
	// Enabled toggles the Mezon đồng payment method.
	Enabled bool
	// ProviderId is the custom OAuth provider whose bindings are treated as
	// Mezon identities. Required when Enabled is true; 0 fails closed so a
	// second OAuth provider cannot be used to claim another user's transfer.
	ProviderId int
	// TreasuryAddress is the on-chain wallet that receives top-up transfers.
	TreasuryAddress string
	// IndexerBase is the base URL of the mmn-tx-explorer indexer API,
	// e.g. "https://dong.mezon.ai/indexer-api".
	IndexerBase string
	// ChainId is the MMN chain id used in indexer paths, e.g. "1337".
	ChainId string
}{
	Enabled:         false,
	ProviderId:      0,
	TreasuryAddress: "",
	IndexerBase:     "https://dong.mezon.ai/indexer-api",
	ChainId:         "1337",
}
