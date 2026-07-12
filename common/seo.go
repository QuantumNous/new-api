package common

import "strings"

// SEO options (admin-configurable). Empty strings mean "use built-in defaults" on the client.
var (
	SEODescription = ""
	SEOKeywords    = ""
	SEOSiteURL     = ""
	SEOOGImage     = ""
	SEORobotsIndex = true
)

// DefaultSEODescription returns a language-aware fallback meta description.
func DefaultSEODescription(lang string) string {
	if strings.HasPrefix(strings.ToLower(lang), "zh") {
		return "统一的 AI 模型网关与管理平台，支持 OpenAI / Claude / Gemini 兼容接口。"
	}
	return "Unified AI API gateway and admin dashboard with OpenAI / Claude / Gemini compatible APIs."
}

// DefaultSEOKeywords returns a language-aware fallback keywords string.
func DefaultSEOKeywords(lang string) string {
	if strings.HasPrefix(strings.ToLower(lang), "zh") {
		return "AI API,大模型网关,OpenAI兼容,Claude,Gemini,New API"
	}
	return "AI API, LLM Gateway, OpenAI Compatible, Claude, Gemini, New API"
}
