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

func TestGeminiThinkingLevelClampsAboveHigh(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{LevelLow, LevelLow},
		{LevelMedium, LevelMedium},
		{LevelHigh, LevelHigh},
		{LevelXHigh, LevelHigh},
		{LevelMax, LevelHigh},
		{LevelMinimal, LevelMinimal},
		{LevelNone, ""},
		{"", ""},
	}
	for _, tt := range tests {
		if got := GeminiThinkingLevel(tt.in); got != tt.want {
			t.Fatalf("GeminiThinkingLevel(%q)=%q, want %q", tt.in, got, tt.want)
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
