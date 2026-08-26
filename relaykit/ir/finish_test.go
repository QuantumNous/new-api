package ir

import "testing"

func TestFinishFromClaude(t *testing.T) {
	t.Parallel()
	cases := map[string]Finish{
		"":              "",
		"end_turn":      FinishStop,
		"stop_sequence": FinishStop,
		"max_tokens":    FinishLength,
		"tool_use":      FinishTool,
		"refusal":       FinishFilter,
		"other":         FinishUnknown,
	}
	for in, want := range cases {
		if got := FinishFromClaude(in); got != want {
			t.Fatalf("FinishFromClaude(%q)=%q want %q", in, got, want)
		}
	}
	if got := FinishStop.ToClaudeStopReason(); got != "end_turn" {
		t.Fatalf("FinishStop=%q", got)
	}
	if got := FinishTool.ToClaudeStopReason(); got != "tool_use" {
		t.Fatalf("FinishTool=%q", got)
	}
}
