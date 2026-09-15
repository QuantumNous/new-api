package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type QuotaResetSetting struct {
	Enabled    bool   `json:"enabled"`
	Period     string `json:"period"`
	ResetValue int    `json:"reset_value"`
}

const (
	QuotaResetPeriodDaily   = "daily"
	QuotaResetPeriodWeekly  = "weekly"
	QuotaResetPeriodMonthly = "monthly"
)

var quotaResetSetting = QuotaResetSetting{
	Enabled:    false,
	Period:     QuotaResetPeriodMonthly,
	ResetValue: 0,
}

func init() {
	config.GlobalConfig.Register("quota_reset_setting", &quotaResetSetting)
}

func GetQuotaResetSetting() *QuotaResetSetting {
	return &quotaResetSetting
}

func IsValidQuotaResetPeriod(period string) bool {
	switch period {
	case QuotaResetPeriodDaily, QuotaResetPeriodWeekly, QuotaResetPeriodMonthly:
		return true
	default:
		return false
	}
}
