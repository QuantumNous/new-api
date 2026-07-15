package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// SeedanceAssetSetting Seedance 素材组/素材管理网关配置
type SeedanceAssetSetting struct {
	Enabled          bool `json:"enabled"`
	GatewayChannelId int  `json:"gateway_channel_id"`
	RefreshOnGet     bool `json:"refresh_on_get"`
}

var seedanceAssetSetting = SeedanceAssetSetting{
	Enabled:          false,
	GatewayChannelId: 0,
	RefreshOnGet:     true,
}

func init() {
	config.GlobalConfig.Register("seedance_asset", &seedanceAssetSetting)
}

func GetSeedanceAssetSetting() *SeedanceAssetSetting {
	return &seedanceAssetSetting
}

func IsSeedanceAssetEnabled() bool {
	return seedanceAssetSetting.Enabled && seedanceAssetSetting.GatewayChannelId > 0
}
