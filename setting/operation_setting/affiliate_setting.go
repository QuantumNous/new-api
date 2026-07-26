package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

const AffiliateMicrosPerUnit int64 = 1_000_000

type AffiliateSetting struct {
	Enabled                 bool   `json:"enabled"`
	Currency                string `json:"currency"`
	RewardMicros            int64  `json:"reward_micros"`
	MinimumTopUpMicros      int64  `json:"minimum_topup_micros"`
	HoldSeconds             int64  `json:"hold_seconds"`
	MinimumWithdrawalMicros int64  `json:"minimum_withdrawal_micros"`
}

var affiliateSetting = AffiliateSetting{
	Enabled:                 false,
	Currency:                "USD",
	RewardMicros:            5 * AffiliateMicrosPerUnit,
	MinimumTopUpMicros:      10 * AffiliateMicrosPerUnit,
	HoldSeconds:             7 * 24 * 60 * 60,
	MinimumWithdrawalMicros: 20 * AffiliateMicrosPerUnit,
}

func init() {
	config.GlobalConfig.Register("affiliate_setting", &affiliateSetting)
}

func GetAffiliateSetting() *AffiliateSetting {
	return &affiliateSetting
}
