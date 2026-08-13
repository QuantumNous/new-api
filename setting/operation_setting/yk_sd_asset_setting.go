package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// YkSdAssetSetting configures the public /api/yk-sd/assets thin proxy.
type YkSdAssetSetting struct {
	Enabled          bool `json:"enabled"`
	GatewayChannelId int  `json:"gateway_channel_id"`
}

var ykSdAssetSetting = YkSdAssetSetting{
	Enabled:          false,
	GatewayChannelId: 0,
}

func init() {
	config.GlobalConfig.Register("yk_sd_asset", &ykSdAssetSetting)
}

func GetYkSdAssetSetting() *YkSdAssetSetting {
	return &ykSdAssetSetting
}

func IsYkSdAssetEnabled() bool {
	return ykSdAssetSetting.Enabled && ykSdAssetSetting.GatewayChannelId > 0
}
