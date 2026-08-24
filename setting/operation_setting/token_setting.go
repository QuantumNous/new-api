package operation_setting

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// TokenSetting 令牌相关配置
type TokenSetting struct {
	MaxUserTokens           int  `json:"max_user_tokens"`             // 每用户最大令牌数量
	RequireEmailVerification bool `json:"require_email_verification"` // 未验证邮箱的用户禁止创建令牌/调用 API（仅当系统开启邮箱验证时生效）
}

// 默认配置
var tokenSetting = TokenSetting{
	MaxUserTokens:           1000, // 默认每用户最多 1000 个令牌
	RequireEmailVerification: true, // 默认要求邮箱验证后才能使用令牌
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("token_setting", &tokenSetting)
}

// GetTokenSetting 获取令牌配置
func GetTokenSetting() *TokenSetting {
	return &tokenSetting
}

// GetMaxUserTokens 获取每用户最大令牌数量
func GetMaxUserTokens() int {
	return GetTokenSetting().MaxUserTokens
}

// RequireEmailVerificationForTokens 返回是否需要邮箱验证才能创建/使用令牌。
// 仅当系统本身开启了邮箱验证功能时才生效，否则一律放行（无验证功能则无从要求）。
func RequireEmailVerificationForTokens() bool {
	return common.EmailVerificationEnabled && GetTokenSetting().RequireEmailVerification
}
