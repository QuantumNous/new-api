package middleware

import (
	"github.com/QuantumNous/new-api/internal/transport/contract"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/constant"
	"github.com/QuantumNous/new-api/internal/i18n"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

// I18n middleware detects and sets the language preference for the request
func I18n() contract.Middleware {
	return func(c contract.Context) {
		lang := detectLanguage(c)
		c.Set(string(constant.ContextKeyLanguage), lang)
		c.Next()
	}
}

// detectLanguage determines the language preference for the request
// Priority: 1. User setting (if logged in) -> 2. Accept-Language header -> 3. Default language
func detectLanguage(c contract.Context) string {
	// 1. Try to get language from user setting (set by auth middleware)
	if userSetting, ok := common.GetCtxKeyType[dto.UserSetting](c, constant.ContextKeyUserSetting); ok {
		if userSetting.Language != "" && i18n.IsSupported(userSetting.Language) {
			return userSetting.Language
		}
	}

	// 2. Parse Accept-Language header
	acceptLang := c.Header("Accept-Language")
	if acceptLang != "" {
		lang := i18n.ParseAcceptLanguage(acceptLang)
		if i18n.IsSupported(lang) {
			return lang
		}
	}

	// 3. Return default language
	return i18n.DefaultLang
}

// GetLanguage returns the current language from the contract context
func GetLanguage(c contract.Context) string {
	if lang := c.GetString(string(constant.ContextKeyLanguage)); lang != "" {
		return lang
	}
	return i18n.DefaultLang
}
