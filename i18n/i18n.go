package i18n

import (
	"embed"
	"slices"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/nicksnyder/go-i18n/v2/i18n"
	"golang.org/x/text/language"
	"gopkg.in/yaml.v3"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

const (
	LangZhCN    = "zh-CN"
	LangZhTW    = "zh-TW"
	LangEn      = "en"
	LangPtBR    = "pt-BR"
	DefaultLang = LangEn // Fallback to English if language not supported
)

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
		files := []string{"locales/zh-CN.yaml", "locales/zh-TW.yaml", "locales/en.yaml", "locales/pt-BR.yaml"}
		for _, file := range files {
			_, err := bundle.LoadMessageFileFS(localeFS, file)
			if err != nil {
				initErr = err
				return
			}
		}

		// Pre-create localizers for supported languages
		localizers[LangZhCN] = i18n.NewLocalizer(bundle, LangZhCN)
		localizers[LangZhTW] = i18n.NewLocalizer(bundle, LangZhTW)
		localizers[LangEn] = i18n.NewLocalizer(bundle, LangEn)
		localizers[LangPtBR] = i18n.NewLocalizer(bundle, LangPtBR)

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

// T translates a message key in the language the reader of the request stated
func T(c *gin.Context, key string, args ...map[string]any) string {
	return Translate(StatedLang(c), key, args...)
}

// Translate translates a message key for the specified language. An empty
// language means the reader stated none and gets common.DefaultLanguage.
func Translate(lang, key string, args ...map[string]any) string {
	if lang == "" {
		lang = common.DefaultLanguage
	}
	loc := GetLocalizer(lang)

	config := &i18n.LocalizeConfig{
		MessageID: key,
	}

	if len(args) > 0 && args[0] != nil {
		config.TemplateData = args[0]
	}

	msg, err := loc.Localize(config)
	if err != nil {
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

// StatedLang returns the language the reader of a request stated, or "" when
// there is none. It checks multiple sources in priority order:
// 1. User settings (ContextKeyUserSetting) - if already loaded (e.g., by TokenAuth)
// 2. Lazy load user language from cache/DB using user ID, when step 1 found no settings
// 3. Language set by middleware (ContextKeyLanguage) - from Accept-Language header
// 4. The Accept-Language header
func StatedLang(c *gin.Context) string {
	if c == nil {
		return ""
	}

	// 1. Try to get language from user settings (if already loaded by TokenAuth or other middleware)
	userSetting, settingLoaded := common.GetContextKeyType[dto.UserSetting](c, constant.ContextKeyUserSetting)
	if settingLoaded && userSetting.Language != "" {
		normalized := normalizeLang(userSetting.Language)
		if IsSupported(normalized) {
			return normalized
		}
	}

	// 2. Lazy load user language using user ID (for session-based auth where full settings aren't loaded).
	// Loaded settings without a language mean the user saved none; loading the user again would cost
	// a cache or database read on every relay request.
	if !settingLoaded && userLangLoaderFunc != nil {
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

	// 3. Try to get language from context (set by I18n middleware from Accept-Language)
	if lang := c.GetString(string(constant.ContextKeyLanguage)); lang != "" {
		normalized := normalizeLang(lang)
		if IsSupported(normalized) {
			return normalized
		}
	}

	// 4. Try Accept-Language header directly (fallback if middleware didn't run)
	return ParseAcceptLanguage(c.GetHeader("Accept-Language"))
}

// ParseAcceptLanguage returns the first language of an Accept-Language header,
// or "" when the header is absent or states no preference ("*").
func ParseAcceptLanguage(header string) string {
	first, _, _ := strings.Cut(header, ",")
	first, _, _ = strings.Cut(first, ";")
	first = strings.TrimSpace(first)
	if first == "" || first == "*" {
		return ""
	}
	return normalizeLang(first)
}

// normalizeLang normalizes language code to supported format
func normalizeLang(lang string) string {
	lang = strings.ToLower(strings.ReplaceAll(strings.TrimSpace(lang), "_", "-"))

	// Handle common variations. The web console saves its own codes zhCN and
	// zhTW, and maps zh-HK, zh-MO and zh-Hant to Traditional Chinese.
	switch {
	case lang == "zhtw" || strings.HasPrefix(lang, "zh-tw") || strings.HasPrefix(lang, "zh-hk") ||
		strings.HasPrefix(lang, "zh-mo") || strings.HasPrefix(lang, "zh-hant"):
		return LangZhTW
	case strings.HasPrefix(lang, "zh"):
		return LangZhCN
	case strings.HasPrefix(lang, "pt"):
		return LangPtBR
	case strings.HasPrefix(lang, "en"):
		return LangEn
	default:
		return DefaultLang
	}
}

// SupportedLanguages returns a list of supported language codes
func SupportedLanguages() []string {
	return []string{LangZhCN, LangZhTW, LangEn, LangPtBR}
}

// IsSupported checks if a language code is supported
func IsSupported(lang string) bool {
	lang = normalizeLang(lang)
	return slices.Contains(SupportedLanguages(), lang)
}
