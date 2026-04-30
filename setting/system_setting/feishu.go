package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type FeishuSettings struct {
	Enabled      bool   `json:"enabled"`
	AppID        string `json:"app_id"`
	AppSecret    string `json:"app_secret"`
	DefaultGroup string `json:"default_group"`
	AuthPolicy   string `json:"auth_policy"`
}

var defaultFeishuSettings = FeishuSettings{
	DefaultGroup: "pending",
	AuthPolicy:   "parallel",
}

func init() {
	config.GlobalConfig.Register("feishu", &defaultFeishuSettings)
}

func GetFeishuSettings() *FeishuSettings {
	return &defaultFeishuSettings
}
