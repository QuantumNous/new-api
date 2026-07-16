package dto

import (
	"encoding/json"
	"testing"
)

// TestResolveReasoningTokensAcrossSchemas covers both usage schemas: Chat
// Completions carries reasoning under completion_tokens_details, the Responses
// API under output_tokens_details. Both must resolve; neither present is 0.
func TestResolveReasoningTokensAcrossSchemas(t *testing.T) {
	tests := []struct {
		name  string
		usage *Usage
		want  int
	}{
		{name: "nil usage", usage: nil, want: 0},
		{name: "neither present", usage: &Usage{}, want: 0},
		{
			name:  "chat completions schema",
			usage: &Usage{CompletionTokenDetails: OutputTokenDetails{ReasoningTokens: 41}},
			want:  41,
		},
		{
			name:  "responses schema",
			usage: &Usage{OutputTokensDetails: &OutputTokenDetails{ReasoningTokens: 64}},
			want:  64,
		},
		{
			name: "chat schema wins when both present",
			usage: &Usage{
				CompletionTokenDetails: OutputTokenDetails{ReasoningTokens: 41},
				OutputTokensDetails:    &OutputTokenDetails{ReasoningTokens: 64},
			},
			want: 41,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.usage.ResolveReasoningTokens(); got != tt.want {
				t.Fatalf("ResolveReasoningTokens() = %d, want %d", got, tt.want)
			}
		})
	}
}

// TestResponsesUsageUnmarshalRecoversReasoningTokens is the regression guard for
// the actual bug: a Responses API usage payload puts reasoning tokens under
// output_tokens_details, which the struct previously had no field for, so the
// value was dropped. Parsing the real shape must now recover it.
func TestResponsesUsageUnmarshalRecoversReasoningTokens(t *testing.T) {
	raw := `{
		"input_tokens": 129725,
		"input_tokens_details": {"cached_tokens": 126720},
		"output_tokens": 520,
		"output_tokens_details": {"reasoning_tokens": 448},
		"total_tokens": 130245
	}`
	var u Usage
	if err := json.Unmarshal([]byte(raw), &u); err != nil {
		t.Fatalf("unmarshal responses usage: %v", err)
	}
	if u.OutputTokens != 520 {
		t.Fatalf("OutputTokens = %d, want 520", u.OutputTokens)
	}
	if got := u.ResolveReasoningTokens(); got != 448 {
		t.Fatalf("ResolveReasoningTokens() = %d, want 448 (dropped before the fix)", got)
	}
}
