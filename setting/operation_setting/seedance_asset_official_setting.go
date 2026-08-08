package operation_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

const (
	// SeedanceOfficialPlatformCN 国内火山方舟
	SeedanceOfficialPlatformCN = "cn"
	// SeedanceOfficialPlatformOverseas 海外 BytePlus ModelArk
	SeedanceOfficialPlatformOverseas = "overseas"
)

// SeedanceAssetOfficialSetting 火山官方私域素材库直连配置
type SeedanceAssetOfficialSetting struct {
	Enabled            bool   `json:"enabled"`
	GatewayChannelId   int    `json:"gateway_channel_id"`
	RefreshOnGet       bool   `json:"refresh_on_get"`
	DefaultCallbackURL string `json:"default_callback_url"`
	// Platform: cn（国内火山）或 overseas（海外 BytePlus），可切换，互不替换
	Platform string `json:"platform"`
	// ProjectName 方舟/BytePlus 项目名，对应控制台 Project（如 project_zzz）
	ProjectName string `json:"project_name"`
}

var seedanceAssetOfficialSetting = SeedanceAssetOfficialSetting{
	Enabled:            false,
	GatewayChannelId:   0,
	RefreshOnGet:       true,
	DefaultCallbackURL: "",
	Platform:           SeedanceOfficialPlatformCN,
	ProjectName:        "default",
}

func init() {
	config.GlobalConfig.Register("seedance_asset_official", &seedanceAssetOfficialSetting)
}

func GetSeedanceAssetOfficialSetting() *SeedanceAssetOfficialSetting {
	return &seedanceAssetOfficialSetting
}

func IsSeedanceAssetOfficialEnabled() bool {
	return seedanceAssetOfficialSetting.Enabled && seedanceAssetOfficialSetting.GatewayChannelId > 0
}

func NormalizeSeedanceOfficialPlatform(platform string) string {
	switch strings.ToLower(strings.TrimSpace(platform)) {
	case SeedanceOfficialPlatformOverseas, "byteplus", "global", "sg", "ap-southeast-1":
		return SeedanceOfficialPlatformOverseas
	default:
		return SeedanceOfficialPlatformCN
	}
}

func GetSeedanceOfficialProjectName() string {
	name := strings.TrimSpace(seedanceAssetOfficialSetting.ProjectName)
	if name == "" {
		return "default"
	}
	return name
}
