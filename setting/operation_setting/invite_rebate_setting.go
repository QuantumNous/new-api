package operation_setting

import (
	"fmt"
	"strconv"

	"github.com/QuantumNous/new-api/setting/config"
)

const (
	InviteRebateTimesOptionKey   = "invite_rebate_setting.times"
	InviteRebatePercentOptionKey = "invite_rebate_setting.percent"
	MaxInviteRebateTimes         = 100
)

// InviteRebateSetting controls recharge rebates for newly invited users.
// Existing invite relationships stay ineligible; only users created with an
// inviter after this feature ships can generate rebates.
type InviteRebateSetting struct {
	Times   int     `json:"times"`   // first N successful wallet top-ups
	Percent float64 `json:"percent"` // 15 means 15% of the amount actually paid
}

var inviteRebateSetting = InviteRebateSetting{
	Times:   0,
	Percent: 0,
}

func init() {
	config.GlobalConfig.Register("invite_rebate_setting", &inviteRebateSetting)
}

func GetInviteRebateSetting() *InviteRebateSetting {
	return &inviteRebateSetting
}

func (s InviteRebateSetting) Normalized() (times int, percent float64) {
	times = s.Times
	if times < 0 {
		times = 0
	}
	if times > MaxInviteRebateTimes {
		times = MaxInviteRebateTimes
	}
	percent = s.Percent
	if percent < 0 {
		percent = 0
	}
	if percent > 100 {
		percent = 100
	}
	return times, percent
}

func (s InviteRebateSetting) Enabled() bool {
	times, percent := s.Normalized()
	return times > 0 && percent > 0
}

func ValidateInviteRebateTimes(value string) error {
	times, err := strconv.Atoi(value)
	if err != nil || times < 0 || times > MaxInviteRebateTimes {
		return fmt.Errorf("invite rebate times must be an integer between 0 and %d", MaxInviteRebateTimes)
	}
	return nil
}

func ValidateInviteRebatePercent(value string) error {
	percent, err := strconv.ParseFloat(value, 64)
	if err != nil || percent < 0 || percent > 100 {
		return fmt.Errorf("invite rebate percent must be between 0 and 100")
	}
	return nil
}
