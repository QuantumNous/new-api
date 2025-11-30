package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type OIDCSettings struct {
	Enabled               bool              `json:"enabled"`
	ClientId              string            `json:"client_id"`
	ClientSecret          string            `json:"client_secret"`
	WellKnown             string            `json:"well_known"`
	AuthorizationEndpoint string            `json:"authorization_endpoint"`
	TokenEndpoint         string            `json:"token_endpoint"`
	UserInfoEndpoint      string            `json:"user_info_endpoint"`
	RoleClaimEnabled      bool              `json:"role_claim_enabled"`      // 是否启用角色声明自动设置用户组
	RoleClaim             string            `json:"role_claim"`              // 角色声明的字段名，默认为 "roles"
	RoleToGroupMapping    map[string]string `json:"role_to_group_mapping"`   // 角色到用户组的映射
	AutoMergeEnabled      bool              `json:"auto_merge_enabled"`      // 是否启用通过邮箱自动合并用户
}

// 默认配置
var defaultOIDCSettings = OIDCSettings{
	RoleClaim:          "roles",
	RoleToGroupMapping: make(map[string]string),
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("oidc", &defaultOIDCSettings)
}

func GetOIDCSettings() *OIDCSettings {
	return &defaultOIDCSettings
}
