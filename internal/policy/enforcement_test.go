package policy

import (
	"strings"
	"testing"
)

func TestSystemPromptFor_ProfileBranches(t *testing.T) {
	tests := []struct {
		name       string
		decision   Decision
		wantPrompt bool
		wantText   string
	}{
		{name: "passthrough", decision: DecisionFor(false, "passthrough"), wantPrompt: false},
		{name: "adult", decision: DecisionFor(false, "adult"), wantPrompt: true, wantText: "adult learner"},
		{name: "kid-safe", decision: DecisionFor(false, "kid-safe"), wantPrompt: true, wantText: "talking with a child"},
		{name: "kids mode override", decision: DecisionFor(true, "adult"), wantPrompt: true, wantText: "talking with a child"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := SystemPromptFor(tt.decision)
			if ok != tt.wantPrompt {
				t.Fatalf("prompt presence mismatch: got %v want %v", ok, tt.wantPrompt)
			}
			if tt.wantText != "" && !strings.Contains(got, tt.wantText) {
				t.Fatalf("prompt %q should contain %q", got, tt.wantText)
			}
		})
	}
}

func TestCheckInput_ProfileBranches(t *testing.T) {
	tests := []struct {
		name      string
		decision  Decision
		input     string
		wantBlock bool
	}{
		{name: "passthrough skips filter", decision: DecisionFor(false, "passthrough"), input: "porn", wantBlock: false},
		{name: "adult narrow filter blocks minor exploitation", decision: DecisionFor(false, "adult"), input: "csam request", wantBlock: true},
		{name: "adult allows kid-safe-only terms", decision: DecisionFor(false, "adult"), input: "explain gambling regulation", wantBlock: false},
		{name: "kid-safe blocks strict terms", decision: DecisionFor(false, "kid-safe"), input: "how does gambling work?", wantBlock: true},
		{name: "kids mode overrides adult profile", decision: DecisionFor(true, "adult"), input: "how does gambling work?", wantBlock: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CheckInput(tt.decision, tt.input)
			if (got != nil) != tt.wantBlock {
				t.Fatalf("block mismatch: got %v wantBlock %v", got, tt.wantBlock)
			}
		})
	}
}
