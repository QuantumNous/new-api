package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type AffiliateSetting struct {
	Enabled                    bool    `json:"enabled"`
	RewardPercent              float64 `json:"reward_percent"`
	SettleAfterInviteeConsumed bool    `json:"settle_after_invitee_consumed"`
	RedemptionEnabled          bool    `json:"redemption_enabled"`
	WithdrawEnabled            bool    `json:"withdraw_enabled"`
}

var affiliateSetting = AffiliateSetting{}

func init() {
	config.GlobalConfig.Register("affiliate_setting", &affiliateSetting)
}

func GetAffiliateSetting() *AffiliateSetting {
	return &affiliateSetting
}
