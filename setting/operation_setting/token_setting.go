package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// TokenSetting token related configuration
type TokenSetting struct {
	MaxUserTokens int `json:"max_user_tokens"` // Maximum number of tokens per user
}

// Default configuration
var tokenSetting = TokenSetting{
	MaxUserTokens: 1000, // Default maximum 1000 tokens per user
}

func init() {
	// Register to the global configuration manager
	config.GlobalConfig.Register("token_setting", &tokenSetting)
}

// GetTokenSetting Gets the token configuration
func GetTokenSetting() *TokenSetting {
	return &tokenSetting
}

// GetMaxUserTokens Gets the maximum number of tokens per user
func GetMaxUserTokens() int {
	return GetTokenSetting().MaxUserTokens
}
