package common

import "strings"

// SEO options (admin-configurable). Empty strings mean "use built-in defaults" on the client.
var (
	// SEOTitle is the full document title when set (long-tail OK).
	// If empty, title is built as: SystemName + " - " + SEOTitleSuffix (or default suffix).
	SEOTitle = ""
	// SEOTitleSuffix is appended after SystemName when SEOTitle is empty.
	SEOTitleSuffix = ""
	SEODescription = ""
	SEOKeywords    = ""
	SEOSiteURL     = ""
	SEOOGImage     = ""
	SEORobotsIndex = true
)

// DefaultSEOTitleSuffix returns a long-tail title suffix for search.
func DefaultSEOTitleSuffix(lang string) string {
	if strings.HasPrefix(strings.ToLower(lang), "zh") {
		return "AI大模型API网关|OpenAI/Claude/Gemini兼容|统一接口管理与分发平台"
	}
	return "AI LLM API Gateway | OpenAI Claude Gemini Compatible | Unified Model Hub"
}

// BuildSEOTitle builds the final page title from options + system name.
func BuildSEOTitle(systemName, lang string) string {
	if t := strings.TrimSpace(SEOTitle); t != "" {
		return t
	}
	name := strings.TrimSpace(systemName)
	if name == "" {
		name = SystemName
	}
	if name == "" {
		name = "DaoXE"
	}
	suffix := strings.TrimSpace(SEOTitleSuffix)
	if suffix == "" {
		suffix = DefaultSEOTitleSuffix(lang)
	}
	if suffix == "" {
		return name
	}
	return name + " - " + suffix
}

// DefaultSEODescription returns a language-aware fallback meta description.
func DefaultSEODescription(lang string) string {
	if strings.HasPrefix(strings.ToLower(lang), "zh") {
		return "统一的 AI 模型网关与管理平台，支持 OpenAI / Claude / Gemini 兼容接口，集中管理多模型 API 密钥、渠道分发与用量计费。"
	}
	return "Unified AI API gateway and admin dashboard with OpenAI / Claude / Gemini compatible APIs, multi-channel routing, key management and usage billing."
}

// DefaultSEOKeywords returns a language-aware fallback keywords string.
func DefaultSEOKeywords(lang string) string {
	if strings.HasPrefix(strings.ToLower(lang), "zh") {
		return "AI API,大模型API,LLM网关,OpenAI兼容接口,Claude API,Gemini API,API聚合分发,模型管理,DaoXE"
	}
	return "AI API, LLM API Gateway, OpenAI Compatible API, Claude API, Gemini API, model aggregation, API distribution, DaoXE"
}
