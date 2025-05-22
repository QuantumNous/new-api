package operation_setting

import (
	"github.com/songquanpeng/one-api/common/config"
)

type CheckinSetting struct {
	RewardAmount int `json:"reward_amount"`
}

var checkinSetting = CheckinSetting{
	RewardAmount: 100, // Default reward amount
}

func init() {
	config.GlobalConfig.Register("checkin", &checkinSetting)
}

func GetCheckinSetting() *CheckinSetting {
	return &checkinSetting
}
