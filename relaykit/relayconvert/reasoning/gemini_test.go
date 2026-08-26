package reasoning

import "testing"

func TestGeminiThinkingControlForModel(t *testing.T) {
	t.Parallel()
	tests := []struct {
		model string
		want  GeminiThinkingControl
	}{
		{"gemini-3.7-pro", GeminiControlLevel},
		{"models/gemini-3-flash-preview", GeminiControlLevel},
		{"gemini-2.5-pro", GeminiControlBudget},
		{"gemini-2.0-flash-thinking-exp", GeminiControlBudget},
		{"gemini-2.0-flash", GeminiControlUnknown},
		{"gemini-2.5-flash-image", GeminiControlUnknown},
	}
	for _, tt := range tests {
		if got := GeminiThinkingControlForModel(tt.model); got != tt.want {
			t.Fatalf("GeminiThinkingControlForModel(%q)=%q want %q", tt.model, got, tt.want)
		}
	}
}

func TestProjectGeminiThinkingUsesOneNativeControl(t *testing.T) {
	t.Parallel()
	include := true
	level := ProjectGeminiThinking("gemini-3.7-pro", false, nil, LevelXHigh, &include, DisplayAuto)
	if level.ThinkingLevel != "HIGH" || level.ThinkingBudget != nil || !level.IncludeThoughts {
		t.Fatalf("level projection=%#v", level)
	}

	budget := ProjectGeminiThinking("gemini-2.5-pro", false, nil, LevelXHigh, &include, DisplayAuto)
	if budget.ThinkingLevel != "" || budget.ThinkingBudget == nil || *budget.ThinkingBudget != -1 {
		t.Fatalf("budget projection=%#v", budget)
	}

	explicit := 16000
	preserved := ProjectGeminiThinking("gemini-3.7-pro", false, &explicit, LevelHigh, &include, DisplayAuto)
	if preserved.ThinkingLevel != "" || preserved.ThinkingBudget == nil || *preserved.ThinkingBudget != explicit {
		t.Fatalf("explicit budget projection=%#v", preserved)
	}
}

func TestNormalizeThinkDisplayVendorValues(t *testing.T) {
	t.Parallel()
	tests := map[string]string{
		"summarized": DisplayAuto,
		"omitted":    DisplayHidden,
		"concise":    DisplayConcise,
		"detailed":   DisplayDetailed,
	}
	for input, want := range tests {
		if got := NormalizeThinkDisplay(input); got != want {
			t.Fatalf("NormalizeThinkDisplay(%q)=%q want %q", input, got, want)
		}
	}
}
