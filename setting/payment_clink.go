package setting

var (
	ClinkEnabled    bool
	ClinkSandbox    bool   = true
	ClinkMinTopUp   int    = 1
	ClinkCurrency   string = "USD"
	ClinkSuccessURL string = "https://apimaster.ai/console/wallet?show_history=true"
	ClinkCancelURL  string = "https://apimaster.ai/console/wallet"
)
