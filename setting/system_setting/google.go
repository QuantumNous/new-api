package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type GoogleSettings struct {
	Enabled      bool   `json:"enabled"`
	ClientId     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
}

// 默认配置
var defaultGoogleSettings = GoogleSettings{}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("google", &defaultGoogleSettings)
}

func GetGoogleSettings() *GoogleSettings {
	return &defaultGoogleSettings
}
