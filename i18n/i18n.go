package i18n

import (
	"embed"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/nicksnyder/go-i18n/v2/i18n"
	"golang.org/x/text/language"
	"gopkg.in/yaml.v3"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
)

const (
	LangZhCN = "zh-CN"
	LangZhTW = "zh-TW"
	LangEn   = "en"
	LangPt   = "pt"
	// Email-only locales: their YAML carries just the email content keys, all
	// other messages fall back to English via the localizer's fallback chain.
	LangEs      = "es"
	LangFr      = "fr"
	LangRu      = "ru"
	LangJa      = "ja"
	LangVi      = "vi"
	DefaultLang = LangEn // Fallback to English if language not supported
)

const LanguagePreferenceCookieName = "fk_locale"

//go:embed locales/*.yaml
var localeFS embed.FS

var (
	bundle     *i18n.Bundle
	localizers = make(map[string]*i18n.Localizer)
	mu         sync.RWMutex
	initOnce   sync.Once
)

// Init initializes the i18n bundle and loads all translation files
func Init() error {
	var initErr error
	initOnce.Do(func() {
		bundle = i18n.NewBundle(language.Chinese)
		bundle.RegisterUnmarshalFunc("yaml", yaml.Unmarshal)

		// Load embedded translation files
		files := []string{
			"locales/zh-CN.yaml", "locales/zh-TW.yaml", "locales/en.yaml", "locales/pt.yaml",
			"locales/es.yaml", "locales/fr.yaml", "locales/ru.yaml", "locales/ja.yaml", "locales/vi.yaml",
		}
		for _, file := range files {
			_, err := bundle.LoadMessageFileFS(localeFS, file)
			if err != nil {
				initErr = err
				return
			}
		}

		// Pre-create localizers for fully-translated languages
		localizers[LangZhCN] = i18n.NewLocalizer(bundle, LangZhCN)
		localizers[LangZhTW] = i18n.NewLocalizer(bundle, LangZhTW)
		localizers[LangEn] = i18n.NewLocalizer(bundle, LangEn)
		localizers[LangPt] = i18n.NewLocalizer(bundle, LangPt)
		// Email-only locales: they define just the email keys. go-i18n's matcher
		// resolves to the locale itself and does NOT fall back per missing key
		// once the locale has any messages loaded, so the English fallback for
		// non-email keys is handled in Translate, not here.
		localizers[LangEs] = i18n.NewLocalizer(bundle, LangEs)
		localizers[LangFr] = i18n.NewLocalizer(bundle, LangFr)
		localizers[LangRu] = i18n.NewLocalizer(bundle, LangRu)
		localizers[LangJa] = i18n.NewLocalizer(bundle, LangJa)
		localizers[LangVi] = i18n.NewLocalizer(bundle, LangVi)

		// Set the TranslateMessage function in common package
		common.TranslateMessage = T
	})
	return initErr
}

// GetLocalizer returns a localizer for the specified language
func GetLocalizer(lang string) *i18n.Localizer {
	lang = normalizeLang(lang)

	mu.RLock()
	loc, ok := localizers[lang]
	mu.RUnlock()

	if ok {
		return loc
	}

	// Create new localizer for unknown language (fallback to default)
	mu.Lock()
	defer mu.Unlock()

	// Double-check after acquiring write lock
	if loc, ok = localizers[lang]; ok {
		return loc
	}

	loc = i18n.NewLocalizer(bundle, lang, DefaultLang)
	localizers[lang] = loc
	return loc
}

// T translates a message key using the language from gin context
func T(c *gin.Context, key string, args ...map[string]any) string {
	lang := GetLangFromContext(c)
	return Translate(lang, key, args...)
}

// Translate translates a message key for the specified language
func Translate(lang, key string, args ...map[string]any) string {
	loc := GetLocalizer(lang)

	config := &i18n.LocalizeConfig{
		MessageID: key,
	}

	if len(args) > 0 && args[0] != nil {
		config.TemplateData = args[0]
	}

	msg, err := loc.Localize(config)
	if err != nil {
		// Key missing in this language (e.g. an email-only locale that defines
		// only the email keys): fall back to English before giving up. go-i18n's
		// own localizer fallback does not cover this — its matcher resolves to
		// the partial locale and returns an error rather than trying English.
		if normalizeLang(lang) != DefaultLang {
			if enMsg, enErr := GetLocalizer(DefaultLang).Localize(config); enErr == nil {
				return enMsg
			}
		}
		// Return key as fallback if translation not found
		return key
	}
	return msg
}

// userLangLoaderFunc is a function that loads user language from database/cache
// It's set by the model package to avoid circular imports
var userLangLoaderFunc func(userId int) string

// SetUserLangLoader sets the function to load user language (called from model package)
func SetUserLangLoader(loader func(userId int) string) {
	userLangLoaderFunc = loader
}

// GetLangFromContext extracts the language setting from gin context
// It checks multiple sources in priority order:
// 1. Browser language preference cookie (fk_locale)
// 2. User settings (ContextKeyUserSetting) - if already loaded (e.g., by TokenAuth)
// 3. Lazy load user language from cache/DB using user ID
// 4. Language set by middleware (ContextKeyLanguage) - from Accept-Language header
// 5. Default language (English)
func GetLangFromContext(c *gin.Context) string {
	if c == nil {
		return DefaultLang
	}

	// 1. Browser cookie is the current UI language intent and may be newer than DB.
	if cookieLang, err := c.Cookie(LanguagePreferenceCookieName); err == nil {
		if normalized, ok := NormalizeLanguage(cookieLang); ok {
			return normalized
		}
	}

	// 2. Try to get language from user settings (if already loaded by TokenAuth or other middleware)
	if userSetting, ok := common.GetContextKeyType[dto.UserSetting](c, constant.ContextKeyUserSetting); ok {
		if userSetting.Language != "" {
			normalized := normalizeLang(userSetting.Language)
			if IsSupported(normalized) {
				return normalized
			}
		}
	}

	// 3. Lazy load user language using user ID (for session-based auth where full settings aren't loaded)
	if userLangLoaderFunc != nil {
		if userId, exists := c.Get("id"); exists {
			if uid, ok := userId.(int); ok && uid > 0 {
				lang := userLangLoaderFunc(uid)
				if lang != "" {
					normalized := normalizeLang(lang)
					if IsSupported(normalized) {
						return normalized
					}
				}
			}
		}
	}

	// 4. Try to get language from context (set by I18n middleware from Accept-Language)
	if lang := c.GetString(string(constant.ContextKeyLanguage)); lang != "" {
		normalized := normalizeLang(lang)
		if IsSupported(normalized) {
			return normalized
		}
	}

	// 5. Try Accept-Language header directly (fallback if middleware didn't run)
	if acceptLang := c.GetHeader("Accept-Language"); acceptLang != "" {
		lang := ParseAcceptLanguage(acceptLang)
		if IsSupported(lang) {
			return lang
		}
	}

	return DefaultLang
}

// ParseAcceptLanguage parses the Accept-Language header and returns the preferred language
func ParseAcceptLanguage(header string) string {
	if header == "" {
		return DefaultLang
	}

	// Simple parsing: take the first language tag
	parts := strings.Split(header, ",")
	if len(parts) == 0 {
		return DefaultLang
	}

	// Get the first language and remove quality value
	firstLang := strings.TrimSpace(parts[0])
	if idx := strings.Index(firstLang, ";"); idx > 0 {
		firstLang = firstLang[:idx]
	}

	return normalizeLang(firstLang)
}

// normalizeLang normalizes language code to supported format
func normalizeLang(lang string) string {
	if normalized, ok := NormalizeLanguage(lang); ok {
		return normalized
	}
	return DefaultLang
}

// NormalizeLanguage normalizes a language tag and reports whether it is supported.
func NormalizeLanguage(lang string) (string, bool) {
	lang = strings.ToLower(strings.TrimSpace(lang))

	// Handle common variations
	switch {
	case strings.HasPrefix(lang, "zh-tw"):
		return LangZhTW, true
	case strings.HasPrefix(lang, "zh"):
		return LangZhCN, true
	case strings.HasPrefix(lang, "en"):
		return LangEn, true
	case lang == LangPt || strings.HasPrefix(lang, "pt-") || strings.HasPrefix(lang, "pt_"):
		return LangPt, true
	case strings.HasPrefix(lang, "es"):
		return LangEs, true
	case strings.HasPrefix(lang, "fr"):
		return LangFr, true
	case strings.HasPrefix(lang, "ru"):
		return LangRu, true
	case strings.HasPrefix(lang, "ja"):
		return LangJa, true
	case strings.HasPrefix(lang, "vi"):
		return LangVi, true
	default:
		return "", false
	}
}

// SupportedLanguages returns a list of supported language codes
func SupportedLanguages() []string {
	return []string{LangZhCN, LangZhTW, LangEn, LangPt, LangEs, LangFr, LangRu, LangJa, LangVi}
}

// IsSupported checks if a language code is supported
func IsSupported(lang string) bool {
	var ok bool
	lang, ok = NormalizeLanguage(lang)
	if !ok {
		return false
	}
	for _, supported := range SupportedLanguages() {
		if lang == supported {
			return true
		}
	}
	return false
}
