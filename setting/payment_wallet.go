package setting

// WalletOnlinePaymentEnabled controls creation of new online wallet top-up
// orders. It defaults to false so payment providers remain disabled until an
// operator explicitly enables them. Existing provider credentials are kept so
// the configuration can be resumed later.
var WalletOnlinePaymentEnabled bool
