package middleware

import (
	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
)

// I18n middleware detects and sets the language preference for the request
func I18n() gin.HandlerFunc {
	return func(c *gin.Context) {
		lang := detectLanguage(c)
		c.Set(string(constant.ContextKeyLanguage), lang)
		c.Next()
	}
}

// detectLanguage determines the language preference for the request
// Priority: 1. User setting (if logged in) -> 2. Browser cookie -> 3. Accept-Language header -> 4. Default language
func detectLanguage(c *gin.Context) string {
	// 1. Try to get language from user setting (set by auth middleware)
	if userSetting, ok := common.GetContextKeyType[dto.UserSetting](c, constant.ContextKeyUserSetting); ok {
		if normalized, ok := i18n.NormalizeLanguage(userSetting.Language); ok {
			return normalized
		}
	}

	// 2. Browser cookie carries the current UI language intent for anonymous requests.
	if cookieLang, err := c.Cookie(i18n.LanguagePreferenceCookieName); err == nil {
		if normalized, ok := i18n.NormalizeLanguage(cookieLang); ok {
			return normalized
		}
	}

	// 3. Parse Accept-Language header
	acceptLang := c.GetHeader("Accept-Language")
	if acceptLang != "" {
		lang := i18n.ParseAcceptLanguage(acceptLang)
		if i18n.IsSupported(lang) {
			return lang
		}
	}

	// 4. Return default language
	return i18n.DefaultLang
}

// GetLanguage returns the current language from gin context
func GetLanguage(c *gin.Context) string {
	if lang := c.GetString(string(constant.ContextKeyLanguage)); lang != "" {
		return lang
	}
	return i18n.DefaultLang
}
