package operation_setting

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

const (
	AffiliateRegistrationTriggerRegistrationSuccess = "registration_success"
	AffiliateRegistrationTriggerFirstQualifiedTopUp = "first_qualified_topup"

	AffiliateRewardModePercentage = "percentage"
	AffiliateRewardModeFixed      = "fixed"

	AffiliateCashbackFrequencyFirstQualified = "first_qualified"
	AffiliateCashbackFrequencyEveryTopUp     = "every_topup"
)

type AffiliateSetting struct {
	Enabled                   bool   `json:"enabled"`
	InviterRewardQuota        int64  `json:"inviter_reward_quota"`
	InviteeRewardQuota        int64  `json:"invitee_reward_quota"`
	RegistrationRewardTrigger string `json:"registration_reward_trigger"`
	RewardMode                string `json:"reward_mode"`
	CashbackFrequency         string `json:"cashback_frequency"`
	RewardRateBps             int64  `json:"reward_rate_bps"`
	FixedRewardQuota          int64  `json:"fixed_reward_quota"`
	UnlimitedReward           bool   `json:"unlimited_reward"`
	MaximumRewardQuota        int64  `json:"maximum_reward_quota"`
	MinimumTopUpCents         int64  `json:"minimum_topup_cents"`
	HoldSeconds               int64  `json:"hold_seconds"`
	MinimumTransferQuota      int64  `json:"minimum_transfer_quota"`
	ShowInviteeTopUps         bool   `json:"show_invitee_topups"`
}

var affiliateSetting = AffiliateSetting{
	Enabled:                   false,
	RegistrationRewardTrigger: AffiliateRegistrationTriggerRegistrationSuccess,
	RewardMode:                AffiliateRewardModePercentage,
	CashbackFrequency:         AffiliateCashbackFrequencyFirstQualified,
	RewardRateBps:             2500,
	FixedRewardQuota:          int64(5 * common.QuotaPerUnit),
	MaximumRewardQuota:        int64(25 * common.QuotaPerUnit),
	MinimumTopUpCents:         20 * 100,
	HoldSeconds:               7 * 24 * 60 * 60,
	MinimumTransferQuota:      int64(common.QuotaPerUnit),
	ShowInviteeTopUps:         true,
}

func init() {
	config.GlobalConfig.Register("affiliate_setting", &affiliateSetting)
}

func GetAffiliateSetting() *AffiliateSetting {
	return &affiliateSetting
}
