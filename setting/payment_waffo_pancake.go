package setting

var (
	WaffoPancakeEnabled          bool
	WaffoPancakeSandbox          bool
	WaffoPancakeMerchantID       string
	WaffoPancakePrivateKey       string
	WaffoPancakeWebhookPublicKey string
	WaffoPancakeWebhookTestKey   string
	WaffoPancakeStoreID          string
	WaffoPancakeProductID        string
	WaffoPancakeReturnURL        string
	WaffoPancakeCurrency         string  = "USD"
	WaffoPancakeUnitPrice        float64 = 1.0
	WaffoPancakeMinTopUp         int     = 1
)
