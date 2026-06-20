package setting

var (
	PlategaEnabled    bool
	PlategaMinTopUp   int     = 1
	PlategaUSDRate    float64 = 90.0 // RUB per 1 USD quota dollar; admin-configurable
	PlategaReturnURL  string  = "https://apimaster.ai/console/wallet?show_history=true"
	PlategaFailedURL  string  = "https://apimaster.ai/console/wallet?show_history=true"
	PlategaFeePercent float64 = 8.5 // SBP QR fee note for admin; not charged to user by default
)
