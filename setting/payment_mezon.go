package setting

// Mezon đồng (MMN chain) top-up settings.
// Users top up by transferring đồng to the treasury wallet inside the Mezon
// app, then submit the transaction hash; the backend verifies the transfer
// against the public indexer before crediting quota.
var MezonPayment = struct {
	// Enabled toggles the Mezon đồng payment method.
	Enabled bool
	// TreasuryAddress is the on-chain wallet that receives top-up transfers.
	TreasuryAddress string
	// IndexerBase is the base URL of the mmn-tx-explorer indexer API,
	// e.g. "https://dong.mezon.ai/indexer-api".
	IndexerBase string
	// ChainId is the MMN chain id used in indexer paths, e.g. "1337".
	ChainId string
}{
	Enabled:         false,
	TreasuryAddress: "",
	IndexerBase:     "https://dong.mezon.ai/indexer-api",
	ChainId:         "1337",
}
