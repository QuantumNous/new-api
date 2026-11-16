package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// CheckinSetting check-in function configuration
type CheckinSetting struct {
	Enabled  bool `json:"enabled"`   // Whether to enable the check-in function
	MinQuota int  `json:"min_quota"` // Minimum amount of reward for signing in
	MaxQuota int  `json:"max_quota"` // Maximum sign-in reward
}

// Default configuration
var checkinSetting = CheckinSetting{
	Enabled:  false, // Off by default
	MinQuota: 1000,  // The default minimum amount is 1000 (approximately 0.002 USD)
	MaxQuota: 10000, // The default maximum amount is 10,000 (approximately 0.02 USD)
}

func init() {
	// Register to the global configuration manager
	config.GlobalConfig.Register("checkin_setting", &checkinSetting)
}

// GetCheckinSetting Gets the check-in configuration
func GetCheckinSetting() *CheckinSetting {
	return &checkinSetting
}

// IsCheckinEnabled Whether to enable the check-in function
func IsCheckinEnabled() bool {
	return checkinSetting.Enabled
}

// GetCheckinQuotaRange Gets the check-in quota range
func GetCheckinQuotaRange() (min, max int) {
	return checkinSetting.MinQuota, checkinSetting.MaxQuota
}
