package system_setting

import "github.com/QuantumNous/new-api/setting/config"

// GrokSettings 是 Grok 订阅渠道的系统设置段（设计 §13）。
// 注册名用 "grok_subscription" 而非 "grok"：后者已被 setting/model_setting 的
// 计费设置（ViolationDeduction）占用，同名 Register 会静默互相覆盖。
type GrokSettings struct {
	PasswordAuthEnabled bool   `json:"password_auth_enabled"`
	CLIClientVersion    string `json:"cli_client_version"`
}

var defaultGrokSettings = GrokSettings{
	PasswordAuthEnabled: false, // 默认关：ToS/风控风险
}

func init() {
	config.GlobalConfig.Register("grok_subscription", &defaultGrokSettings)
}

func GetGrokSubscriptionSettings() *GrokSettings {
	return &defaultGrokSettings
}
