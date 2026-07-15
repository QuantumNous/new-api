package service

import (
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// ChannelLimits is the effective limit set for a channel after applying the
// global toggle. MaxConcurrency of 0 means "unlimited".
type ChannelLimits struct {
	Enabled        bool
	MaxConcurrency int
}

// GetChannelLimits returns the effective limit set for a channel.
func GetChannelLimits(channel *model.Channel) ChannelLimits {
	g := operation_setting.GetChannelLimitSetting()
	if !g.Enabled {
		return ChannelLimits{Enabled: false}
	}
	s := channel.GetSetting()
	return ChannelLimits{
		Enabled:        true,
		MaxConcurrency: s.MaxConcurrency,
	}
}
