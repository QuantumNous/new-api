package reasoning

import "strings"

const (
	LevelNone    = "none"
	LevelMinimal = "minimal"
	LevelLow     = "low"
	LevelMedium  = "medium"
	LevelHigh    = "high"
	LevelXHigh   = "xhigh"
	LevelMax     = "max"
)

// NormalizeThinkingLevel canonicalizes a thinking / reasoning effort string.
// Unknown values return empty so callers can omit rather than invent a level.
func NormalizeThinkingLevel(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	s = strings.ReplaceAll(s, "-", "")
	s = strings.ReplaceAll(s, "_", "")
	switch s {
	case "none", "off", "disabled", "nothinking":
		return LevelNone
	case "minimal", "min":
		return LevelMinimal
	case "low":
		return LevelLow
	case "medium", "med":
		return LevelMedium
	case "high":
		return LevelHigh
	case "xhigh", "extrahigh", "extra":
		return LevelXHigh
	case "max", "maximum":
		return LevelMax
	default:
		return ""
	}
}

func IsDisabledThinkingLevel(level string) bool {
	return NormalizeThinkingLevel(level) == LevelNone
}

// OpenAIReasoningEffort is the Chat Completions / Responses effort field.
func OpenAIReasoningEffort(level string) string {
	return NormalizeThinkingLevel(level)
}

// GeminiThinkingLevel serializes a canonical level using the native
// generateContent enum. Gemini's range stops at HIGH, so xhigh/max collapse
// to HIGH at this protocol boundary.
func GeminiThinkingLevel(level string) string {
	switch NormalizeThinkingLevel(level) {
	case LevelMinimal:
		return "MINIMAL"
	case LevelLow:
		return "LOW"
	case LevelMedium:
		return "MEDIUM"
	case LevelHigh, LevelXHigh, LevelMax:
		return "HIGH"
	default:
		return ""
	}
}

// ParseGeminiThinkingLevel accepts native enum casing as well as permissive
// compatibility casing and returns the protocol-neutral canonical value.
func ParseGeminiThinkingLevel(level string) string {
	return NormalizeThinkingLevel(level)
}

// ClaudeThinkingEffort maps a canonical level onto Claude output_config.effort.
// Claude's documented range is low/medium/high/max, so xhigh becomes max.
func ClaudeThinkingEffort(level string) string {
	switch NormalizeThinkingLevel(level) {
	case LevelMinimal, LevelLow:
		return LevelLow
	case LevelMedium:
		return LevelMedium
	case LevelHigh:
		return LevelHigh
	case LevelXHigh, LevelMax:
		return LevelMax
	default:
		return ""
	}
}
