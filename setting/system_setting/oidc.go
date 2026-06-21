package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type OIDCSettings struct {
	Enabled               bool   `json:"enabled"`
	ClientId              string `json:"client_id"`
	ClientSecret          string `json:"client_secret"`
	WellKnown             string `json:"well_known"`
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	UserInfoEndpoint      string `json:"user_info_endpoint"`
	// DisplayName 自定义登录按钮名称，为空时前端回退到默认 "OIDC"
	DisplayName string `json:"display_name"`
	// Logo 自定义登录按钮图标，存储为 base64 data URL（支持图片及 SVG）
	Logo string `json:"logo"`
}

// 默认配置
var defaultOIDCSettings = OIDCSettings{}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("oidc", &defaultOIDCSettings)
}

func GetOIDCSettings() *OIDCSettings {
	return &defaultOIDCSettings
}
