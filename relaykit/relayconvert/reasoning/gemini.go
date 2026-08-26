package reasoning

import "strings"

type GeminiThinkingControl string

const (
	GeminiControlUnknown GeminiThinkingControl = "unknown"
	GeminiControlLevel   GeminiThinkingControl = "level"
	GeminiControlBudget  GeminiThinkingControl = "budget"
)

// GeminiThinkingProjection is the native generateContent representation of a
// protocol-neutral thinking request. Level is already serialized with native
// enum casing. Budget and Level are mutually exclusive.
type GeminiThinkingProjection struct {
	IncludeThoughts bool
	ThinkingBudget  *int
	ThinkingLevel   string
}

// GeminiThinkingControlForModel centralizes model capability routing. Gemini
// 3+ text models use thinkingLevel; Gemini 2.5 and the 2.0 thinking
// experiments use thinkingBudget. Unknown model names are projected only when
// the request carries an explicit thinking intent.
func GeminiThinkingControlForModel(model string) GeminiThinkingControl {
	name := normalizeGeminiModelName(model)
	if name == "" || isGeminiImageModel(name) {
		return GeminiControlUnknown
	}
	switch {
	case strings.Contains(name, "gemini-3"), strings.Contains(name, "gemini-4"):
		return GeminiControlLevel
	case strings.Contains(name, "gemini-2.5"), strings.Contains(name, "gemini-2-5"):
		return GeminiControlBudget
	case (strings.Contains(name, "gemini-2.0") || strings.Contains(name, "gemini-2-0")) && strings.Contains(name, "thinking"):
		return GeminiControlBudget
	default:
		return GeminiControlUnknown
	}
}

func GeminiModelSupportsThinking(model string) bool {
	name := normalizeGeminiModelName(model)
	if name == "" || isGeminiImageModel(name) {
		return false
	}
	return GeminiThinkingControlForModel(model) != GeminiControlUnknown || strings.Contains(name, "thinking")
}

// ProjectGeminiThinking maps canonical IR fields to one non-conflicting
// native Gemini control. Explicit numeric budgets are preserved. When a
// budget-only model receives a discrete effort without a numeric budget, -1
// requests dynamic model-selected thinking.
func ProjectGeminiThinking(model string, disabled bool, budget *int, level string, include *bool, display string) GeminiThinkingProjection {
	control := GeminiThinkingControlForModel(model)
	projection := GeminiThinkingProjection{}

	if disabled {
		projection.IncludeThoughts = false
		switch control {
		case GeminiControlLevel:
			// Level-based Gemini models have no native OFF enum. MINIMAL is the
			// closest supported control; the conversion loss is reported by the
			// IR hub.
			projection.ThinkingLevel = GeminiThinkingLevel(LevelMinimal)
		default:
			zero := 0
			projection.ThinkingBudget = &zero
		}
		return projection
	}

	if include != nil {
		projection.IncludeThoughts = *include
	} else {
		projection.IncludeThoughts = ThinkDisplayWantsThoughts(display)
	}
	if NormalizeThinkDisplay(display) == DisplayHidden {
		projection.IncludeThoughts = false
	}

	if budget != nil {
		value := *budget
		projection.ThinkingBudget = &value
		return projection
	}

	canonical := NormalizeThinkingLevel(level)
	if canonical == "" || canonical == LevelNone {
		return projection
	}
	if control == GeminiControlBudget {
		dynamic := -1
		projection.ThinkingBudget = &dynamic
		return projection
	}
	projection.ThinkingLevel = GeminiThinkingLevel(canonical)
	return projection
}

func normalizeGeminiModelName(model string) string {
	name := strings.ToLower(strings.TrimSpace(model))
	name = strings.TrimPrefix(name, "models/")
	if separator := strings.LastIndex(name, "/"); separator >= 0 {
		name = name[separator+1:]
	}
	return name
}

func isGeminiImageModel(name string) bool {
	return strings.Contains(name, "imagen") || strings.Contains(name, "-image")
}
