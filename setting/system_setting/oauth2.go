package system_setting

import "one-api/setting/config"

type OAuth2Settings struct {
	Enabled             bool                `json:"enabled"`
	Issuer              string              `json:"issuer"`
	AccessTokenTTL      int                 `json:"access_token_ttl"`    // in minutes
	RefreshTokenTTL     int                 `json:"refresh_token_ttl"`   // in minutes
	AllowedGrantTypes   []string            `json:"allowed_grant_types"` // client_credentials, authorization_code, refresh_token
	RequirePKCE         bool                `json:"require_pkce"`        // force PKCE for authorization code flow
	JWTSigningAlgorithm string              `json:"jwt_signing_algorithm"`
	JWTKeyID            string              `json:"jwt_key_id"`
	JWTPrivateKeyFile   string              `json:"jwt_private_key_file"`
	AutoCreateUser      bool                `json:"auto_create_user"`   // auto create user on first OAuth2 login
	DefaultUserRole     int                 `json:"default_user_role"`  // default role for auto-created users
	DefaultUserGroup    string              `json:"default_user_group"` // default group for auto-created users
	ScopeMappings       map[string][]string `json:"scope_mappings"`     // scope to permissions mapping
}

// 默认配置
var defaultOAuth2Settings = OAuth2Settings{
	Enabled:             false,
	AccessTokenTTL:      10,  // 10 minutes
	RefreshTokenTTL:     720, // 12 hours
	AllowedGrantTypes:   []string{"client_credentials", "authorization_code", "refresh_token"},
	RequirePKCE:         true,
	JWTSigningAlgorithm: "RS256",
	JWTKeyID:            "oauth2-key-1",
	AutoCreateUser:      false,
	DefaultUserRole:     1, // common user
	DefaultUserGroup:    "default",
	ScopeMappings: map[string][]string{
		"api:read":  {"read"},
		"api:write": {"write"},
		"admin":     {"admin"},
	},
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("oauth2", &defaultOAuth2Settings)
}

func GetOAuth2Settings() *OAuth2Settings {
	return &defaultOAuth2Settings
}

// UpdateOAuth2Settings 更新OAuth2配置
func UpdateOAuth2Settings(settings OAuth2Settings) {
	defaultOAuth2Settings = settings
}

// ValidateGrantType 验证授权类型是否被允许
func (s *OAuth2Settings) ValidateGrantType(grantType string) bool {
	for _, allowedType := range s.AllowedGrantTypes {
		if allowedType == grantType {
			return true
		}
	}
	return false
}

// GetScopePermissions 获取scope对应的权限
func (s *OAuth2Settings) GetScopePermissions(scope string) []string {
	if perms, exists := s.ScopeMappings[scope]; exists {
		return perms
	}
	return []string{}
}
