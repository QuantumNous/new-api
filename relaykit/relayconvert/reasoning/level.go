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

// GeminiThinkingLevel maps a canonical level onto Gemini thinkingLevel.
// Gemini's documented range stops at high, so xhigh/max collapse to high.
func GeminiThinkingLevel(level string) string {
	switch NormalizeThinkingLevel(level) {
	case LevelMinimal:
		return LevelMinimal
	case LevelLow:
		return LevelLow
	case LevelMedium:
		return LevelMedium
	case LevelHigh, LevelXHigh, LevelMax:
		return LevelHigh
	default:
		return ""
	}
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
