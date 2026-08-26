package reasoning

import "strings"

type GeminiThinkingControl string

const (
	GeminiControlUnknown GeminiThinkingControl = "unknown"
	GeminiControlLevel   GeminiThinkingControl = "level"
	GeminiControlBudget  GeminiThinkingControl = "budget"
)

// GeminiThinkingProjectionLoss identifies a non-exact native Gemini fallback.
type GeminiThinkingProjectionLoss string

const (
	GeminiLossBudgetToLevel  GeminiThinkingProjectionLoss = "budget_to_level"
	GeminiLossBudgetDropped  GeminiThinkingProjectionLoss = "budget_dropped"
	GeminiLossLevelDropped   GeminiThinkingProjectionLoss = "level_dropped"
	GeminiLossLevelCapped    GeminiThinkingProjectionLoss = "level_capped"
	GeminiLossEffortToBudget GeminiThinkingProjectionLoss = "effort_to_budget"
	GeminiLossModeCoerced    GeminiThinkingProjectionLoss = "mode_coerced"
	GeminiLossUnknownControl GeminiThinkingProjectionLoss = "unknown_control"
)

// GeminiThinkingProjection is the native generateContent representation of a
// protocol-neutral thinking request. Level is already serialized with native
// enum casing. Budget and Level are mutually exclusive.
type GeminiThinkingProjection struct {
	IncludeThoughts bool
	ThinkingBudget  *int
	ThinkingLevel   string
	Losses          []GeminiThinkingProjectionLoss
}

func (p *GeminiThinkingProjection) addLoss(loss GeminiThinkingProjectionLoss) {
	for _, existing := range p.Losses {
		if existing == loss {
			return
		}
	}
	p.Losses = append(p.Losses, loss)
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

// ProjectGeminiThinking maps canonical IR fields to exactly one native Gemini
// control. The target model capability decides whether a source budget or level
// can be emitted: level-based models never receive thinkingBudget, while
// budget-based models never receive thinkingLevel. Losses describe every
// non-exact fallback so callers can expose them in conversion reports.
func ProjectGeminiThinking(model string, disabled bool, budget *int, level string, include *bool, display string) GeminiThinkingProjection {
	control := GeminiThinkingControlForModel(model)
	projection := GeminiThinkingProjection{}
	canonical := NormalizeThinkingLevel(level)

	if disabled {
		projection.IncludeThoughts = false
		switch control {
		case GeminiControlLevel:
			// Level-based Gemini models have no native OFF enum. MINIMAL is the
			// closest supported control, with visible thoughts disabled.
			projection.ThinkingLevel = GeminiThinkingLevel(LevelMinimal)
			projection.addLoss(GeminiLossModeCoerced)
		default:
			zero := 0
			projection.ThinkingBudget = &zero
			if control == GeminiControlUnknown {
				projection.addLoss(GeminiLossUnknownControl)
			}
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

	switch control {
	case GeminiControlLevel:
		projectGeminiLevelControl(&projection, budget, canonical)
	case GeminiControlBudget:
		projectGeminiBudgetControl(&projection, budget, canonical)
	default:
		projectUnknownGeminiControl(&projection, budget, canonical)
		if hasExplicitGeminiThinkingIntent(budget, canonical, include, display) {
			projection.addLoss(GeminiLossUnknownControl)
		}
	}
	return projection
}

func projectGeminiLevelControl(projection *GeminiThinkingProjection, budget *int, canonical string) {
	if canonical != "" && canonical != LevelNone {
		projection.ThinkingLevel = GeminiThinkingLevel(canonical)
		if budget != nil {
			projection.addLoss(GeminiLossBudgetDropped)
		}
		if canonical == LevelXHigh || canonical == LevelMax {
			projection.addLoss(GeminiLossLevelCapped)
		}
		return
	}
	if budget != nil && *budget > 0 {
		projection.ThinkingLevel = GeminiThinkingLevel(LevelHigh)
		projection.addLoss(GeminiLossBudgetToLevel)
	}
}

func projectGeminiBudgetControl(projection *GeminiThinkingProjection, budget *int, canonical string) {
	if budget != nil {
		value := *budget
		projection.ThinkingBudget = &value
		if canonical != "" && canonical != LevelNone {
			projection.addLoss(GeminiLossLevelDropped)
		}
		return
	}
	if canonical == "" || canonical == LevelNone {
		return
	}
	dynamic := -1
	projection.ThinkingBudget = &dynamic
	projection.addLoss(GeminiLossEffortToBudget)
}

func projectUnknownGeminiControl(projection *GeminiThinkingProjection, budget *int, canonical string) {
	// Preserve the existing compatibility order for unknown models without ever
	// sending both native control fields.
	if budget != nil {
		value := *budget
		projection.ThinkingBudget = &value
		if canonical != "" && canonical != LevelNone {
			projection.addLoss(GeminiLossLevelDropped)
		}
		return
	}
	if canonical == "" || canonical == LevelNone {
		return
	}
	projection.ThinkingLevel = GeminiThinkingLevel(canonical)
	if canonical == LevelXHigh || canonical == LevelMax {
		projection.addLoss(GeminiLossLevelCapped)
	}
}

func hasExplicitGeminiThinkingIntent(budget *int, canonical string, include *bool, display string) bool {
	return budget != nil ||
		(canonical != "" && canonical != LevelNone) ||
		include != nil ||
		NormalizeThinkDisplay(display) != ""
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
