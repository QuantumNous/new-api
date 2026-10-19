package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// YbModerationSetting configures the public /v1/moderation/face thin proxy for yb (yabaoai).
type YbModerationSetting struct {
	Enabled          bool `json:"enabled"`
	GatewayChannelId int  `json:"gateway_channel_id"`
}

var ybModerationSetting = YbModerationSetting{
	Enabled:          false,
	GatewayChannelId: 0,
}

func init() {
	config.GlobalConfig.Register("yb_moderation", &ybModerationSetting)
}

func GetYbModerationSetting() *YbModerationSetting {
	return &ybModerationSetting
}

func IsYbModerationEnabled() bool {
	return ybModerationSetting.Enabled && ybModerationSetting.GatewayChannelId > 0
}
