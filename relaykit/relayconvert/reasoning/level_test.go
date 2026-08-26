package reasoning

import "testing"

func TestNormalizeThinkingLevel(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"", ""},
		{"LOW", LevelLow},
		{" medium ", LevelMedium},
		{"x-high", LevelXHigh},
		{"extra_high", LevelXHigh},
		{"MAX", LevelMax},
		{"none", LevelNone},
		{"minimal", LevelMinimal},
		{"not-a-level", ""},
	}
	for _, tt := range tests {
		if got := NormalizeThinkingLevel(tt.in); got != tt.want {
			t.Fatalf("NormalizeThinkingLevel(%q)=%q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestGeminiThinkingLevelUsesNativeEnumAndClampsAboveHigh(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{LevelLow, "LOW"},
		{LevelMedium, "MEDIUM"},
		{LevelHigh, "HIGH"},
		{LevelXHigh, "HIGH"},
		{LevelMax, "HIGH"},
		{LevelMinimal, "MINIMAL"},
		{LevelNone, ""},
		{"", ""},
	}
	for _, tt := range tests {
		if got := GeminiThinkingLevel(tt.in); got != tt.want {
			t.Fatalf("GeminiThinkingLevel(%q)=%q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestParseGeminiThinkingLevelAcceptsAnyCasing(t *testing.T) {
	for _, input := range []string{"HIGH", "high", "High"} {
		if got := ParseGeminiThinkingLevel(input); got != LevelHigh {
			t.Fatalf("ParseGeminiThinkingLevel(%q)=%q", input, got)
		}
	}
}

func TestClaudeThinkingEffortMapsXHighToMax(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{LevelMinimal, LevelLow},
		{LevelLow, LevelLow},
		{LevelMedium, LevelMedium},
		{LevelHigh, LevelHigh},
		{LevelXHigh, LevelMax},
		{LevelMax, LevelMax},
		{LevelNone, ""},
	}
	for _, tt := range tests {
		if got := ClaudeThinkingEffort(tt.in); got != tt.want {
			t.Fatalf("ClaudeThinkingEffort(%q)=%q, want %q", tt.in, got, tt.want)
		}
	}
}
