package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type FeishuSettings struct {
	Enabled   bool   `json:"enabled"`
	AppId     string `json:"app_id"`
	AppSecret string `json:"app_secret"`
}

var defaultFeishuSettings = FeishuSettings{}

func init() {
	config.GlobalConfig.Register("feishu", &defaultFeishuSettings)
}

func GetFeishuSettings() *FeishuSettings {
	return &defaultFeishuSettings
}
