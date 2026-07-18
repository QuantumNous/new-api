package operation_setting

import (
	"github.com/QuantumNous/new-api/setting/config"
)

// ChannelLimitSetting holds the global toggle for per-channel concurrency control.
// Registered with config.GlobalConfig so it auto-loads/saves from the options
// table under key "channel_limit_setting.enabled".
type ChannelLimitSetting struct {
	Enabled bool `json:"enabled"`
}

var channelLimitSetting = ChannelLimitSetting{
	Enabled: true,
}

func init() {
	config.GlobalConfig.Register("channel_limit_setting", &channelLimitSetting)
}

func GetChannelLimitSetting() *ChannelLimitSetting {
	return &channelLimitSetting
}
