package reasoning

import "strings"

const (
	DisplayHidden   = "hidden"
	DisplayAuto     = "auto"
	DisplayConcise  = "concise"
	DisplayDetailed = "detailed"
)

// NormalizeThinkDisplay folds protocol-specific visibility values into the
// protocol-neutral display modes used by the IR.
func NormalizeThinkDisplay(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "hidden", "none", "off", "disabled", "omitted":
		return DisplayHidden
	case "auto", "summary", "summarized", "visible":
		return DisplayAuto
	case "concise":
		return DisplayConcise
	case "detailed":
		return DisplayDetailed
	default:
		return ""
	}
}

func ThinkDisplayWantsThoughts(display string) bool {
	switch NormalizeThinkDisplay(display) {
	case DisplayAuto, DisplayConcise, DisplayDetailed:
		return true
	default:
		return false
	}
}

func ResponsesSummaryMode(display string) string {
	switch NormalizeThinkDisplay(display) {
	case DisplayAuto:
		return DisplayAuto
	case DisplayConcise:
		return DisplayConcise
	case DisplayDetailed:
		return DisplayDetailed
	default:
		return ""
	}
}

func ClaudeThinkingDisplay(display string) string {
	switch NormalizeThinkDisplay(display) {
	case DisplayHidden:
		return "omitted"
	case DisplayAuto, DisplayConcise, DisplayDetailed:
		return "summarized"
	default:
		return ""
	}
}
