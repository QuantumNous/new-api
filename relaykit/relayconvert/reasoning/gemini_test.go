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

func TestProjectGeminiThinkingCapabilityMatrix(t *testing.T) {
	t.Parallel()
	include := true
	budget := 2048
	tests := []struct {
		name        string
		model       string
		disabled    bool
		budget      *int
		level       string
		include     *bool
		display     string
		wantInclude bool
		wantBudget  *int
		wantLevel   string
		wantLosses  []GeminiThinkingProjectionLoss
	}{
		{
			name:        "level model maps a positive budget to high",
			model:       "gemini-3.7-flash",
			budget:      &budget,
			include:     &include,
			display:     DisplayAuto,
			wantInclude: true,
			wantLevel:   "HIGH",
			wantLosses:  []GeminiThinkingProjectionLoss{GeminiLossBudgetToLevel},
		},
		{
			name:        "level model prefers explicit level over budget",
			model:       "gemini-3.7-flash",
			budget:      &budget,
			level:       LevelMedium,
			include:     &include,
			display:     DisplayAuto,
			wantInclude: true,
			wantLevel:   "MEDIUM",
			wantLosses:  []GeminiThinkingProjectionLoss{GeminiLossBudgetDropped},
		},
		{
			name:        "level model caps xhigh",
			model:       "publishers/google/models/gemini-3.7-pro-xhigh",
			level:       LevelXHigh,
			include:     &include,
			display:     DisplayAuto,
			wantInclude: true,
			wantLevel:   "HIGH",
			wantLosses:  []GeminiThinkingProjectionLoss{GeminiLossLevelCapped},
		},
		{
			name:       "level model uses minimal to disable",
			model:      "gemini-3.7-flash",
			disabled:   true,
			display:    DisplayHidden,
			wantLevel:  "MINIMAL",
			wantLosses: []GeminiThinkingProjectionLoss{GeminiLossModeCoerced},
		},
		{
			name:        "budget model preserves explicit budget",
			model:       "gemini-2.5-flash",
			budget:      &budget,
			include:     &include,
			display:     DisplayAuto,
			wantInclude: true,
			wantBudget:  intPointer(budget),
		},
		{
			name:        "budget model prefers explicit budget over level",
			model:       "gemini-2.5-flash",
			budget:      &budget,
			level:       LevelMedium,
			include:     &include,
			display:     DisplayAuto,
			wantInclude: true,
			wantBudget:  intPointer(budget),
			wantLosses:  []GeminiThinkingProjectionLoss{GeminiLossLevelDropped},
		},
		{
			name:        "budget model converts effort to dynamic budget",
			model:       "gemini-2.5-flash",
			level:       LevelHigh,
			include:     &include,
			display:     DisplayAuto,
			wantInclude: true,
			wantBudget:  intPointer(-1),
			wantLosses:  []GeminiThinkingProjectionLoss{GeminiLossEffortToBudget},
		},
		{
			name:       "budget model disables with zero",
			model:      "gemini-2.5-flash",
			disabled:   true,
			display:    DisplayHidden,
			wantBudget: intPointer(0),
		},
		{
			name:        "unknown model conservatively preserves budget",
			model:       "gemini-future",
			budget:      &budget,
			include:     &include,
			display:     DisplayAuto,
			wantInclude: true,
			wantBudget:  intPointer(budget),
			wantLosses:  []GeminiThinkingProjectionLoss{GeminiLossUnknownControl},
		},
		{
			name:        "visible thoughts do not invent level control",
			model:       "gemini-3.7-flash",
			include:     &include,
			display:     DisplayAuto,
			wantInclude: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := ProjectGeminiThinking(tt.model, tt.disabled, tt.budget, tt.level, tt.include, tt.display)
			if got.IncludeThoughts != tt.wantInclude {
				t.Fatalf("IncludeThoughts=%v want %v; projection=%#v", got.IncludeThoughts, tt.wantInclude, got)
			}
			if got.ThinkingLevel != tt.wantLevel {
				t.Fatalf("ThinkingLevel=%q want %q; projection=%#v", got.ThinkingLevel, tt.wantLevel, got)
			}
			if !equalOptionalInt(got.ThinkingBudget, tt.wantBudget) {
				t.Fatalf("ThinkingBudget=%v want %v; projection=%#v", got.ThinkingBudget, tt.wantBudget, got)
			}
			if got.ThinkingBudget != nil && got.ThinkingLevel != "" {
				t.Fatalf("native controls must be mutually exclusive: %#v", got)
			}
			if !equalProjectionLosses(got.Losses, tt.wantLosses) {
				t.Fatalf("Losses=%v want %v; projection=%#v", got.Losses, tt.wantLosses, got)
			}
		})
	}
}

func intPointer(value int) *int {
	return &value
}

func equalOptionalInt(got, want *int) bool {
	if got == nil || want == nil {
		return got == nil && want == nil
	}
	return *got == *want
}

func equalProjectionLosses(got, want []GeminiThinkingProjectionLoss) bool {
	if len(got) != len(want) {
		return false
	}
	for i := range got {
		if got[i] != want[i] {
			return false
		}
	}
	return true
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
