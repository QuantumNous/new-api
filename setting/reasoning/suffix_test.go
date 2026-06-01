package reasoning

import "testing"

func TestIsLegacyClaudeThinkingModel(t *testing.T) {
	tests := []struct {
		model string
		want  bool
	}{
		{model: "claude-3-opus-20240229", want: true},
		{model: "claude-3-sonnet-20240229-thinking", want: true},
		{model: "claude-3-5-sonnet-20241022", want: true},
		{model: "claude-3-7-sonnet-20250219-high", want: true},
		{model: "claude-opus-4-20250514", want: true},
		{model: "claude-opus-4-20250514-thinking", want: true},
		{model: "claude-opus-4-1-20250805", want: true},
		{model: "claude-opus-4-5-20251101-thinking", want: true},
		{model: "claude-opus-4-6", want: true},
		{model: "claude-opus-4-6-high", want: true},
		{model: "claude-opus-4-7", want: false},
		{model: "claude-opus-4-7-high", want: false},
		{model: "claude-opus-4-8-thinking", want: false},
		{model: "claude-opus-4-9-high", want: false},
		{model: "claude-opus-4-10-thinking", want: false},
		{model: "claude-sonnet-4-6-thinking", want: false},
		{model: "claude-sonnet-4-8-high", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			if got := IsLegacyClaudeThinkingModel(tt.model); got != tt.want {
				t.Fatalf("IsLegacyClaudeThinkingModel(%q) = %v, want %v", tt.model, got, tt.want)
			}
		})
	}
}

func TestIsClaudeModel(t *testing.T) {
	if !IsClaudeModel("claude-opus-4-8") {
		t.Fatal("expected Claude model")
	}
	if IsClaudeModel("gpt-5") {
		t.Fatal("expected non-Claude model")
	}
}
