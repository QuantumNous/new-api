package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type FeishuSettings struct {
	Enabled                         bool   `json:"enabled"`
	AppID                           string `json:"app_id"`
	AppSecret                       string `json:"app_secret"`
	DefaultGroup                    string `json:"default_group"`
	AuthPolicy                      string `json:"auth_policy"`
	AllowAdminManagePlaintextTokens bool   `json:"allow_admin_manage_plaintext_tokens"`
	InitWebhookSecret               string `json:"init_webhook_secret"`
}

var defaultFeishuSettings = FeishuSettings{
	DefaultGroup:                    "pending",
	AuthPolicy:                      "parallel",
	AllowAdminManagePlaintextTokens: true,
}

func init() {
	config.GlobalConfig.Register("feishu", &defaultFeishuSettings)
}

func GetFeishuSettings() *FeishuSettings {
	return &defaultFeishuSettings
}
