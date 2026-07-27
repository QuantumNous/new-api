package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

const AffiliateMicrosPerUnit int64 = 1_000_000

type AffiliateSetting struct {
	Enabled                 bool   `json:"enabled"`
	Currency                string `json:"currency"`
	RewardRateBps           int64  `json:"reward_rate_bps"`
	RewardMicros            int64  `json:"reward_micros"`
	MinimumTopUpMicros      int64  `json:"minimum_topup_micros"`
	HoldSeconds             int64  `json:"hold_seconds"`
	MinimumWithdrawalMicros int64  `json:"minimum_withdrawal_micros"`
}

var affiliateSetting = AffiliateSetting{
	Enabled:                 false,
	Currency:                "CNY",
	RewardRateBps:           2500,
	RewardMicros:            25 * AffiliateMicrosPerUnit,
	MinimumTopUpMicros:      20 * AffiliateMicrosPerUnit,
	HoldSeconds:             7 * 24 * 60 * 60,
	MinimumWithdrawalMicros: 20 * AffiliateMicrosPerUnit,
}

func init() {
	config.GlobalConfig.Register("affiliate_setting", &affiliateSetting)
}

func GetAffiliateSetting() *AffiliateSetting {
	return &affiliateSetting
}
