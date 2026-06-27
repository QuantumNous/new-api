package model

import "testing"

// TestMatchModelLimit covers the DR-1001 wildcard whitelist matcher: exact-first,
// trailing-"*" prefix, bare "*", and the negative cases that must stay forbidden.
func TestMatchModelLimit(t *testing.T) {
	limitsOf := func(entries ...string) map[string]bool {
		m := make(map[string]bool, len(entries))
		for _, e := range entries {
			m[e] = true
		}
		return m
	}

	cases := []struct {
		name   string
		limits map[string]bool
		model  string
		want   bool
	}{
		{"exact match", limitsOf("claude-opus-4-8"), "claude-opus-4-8", true},
		{"exact miss", limitsOf("claude-opus-4-8"), "claude-sonnet-4-6", false},

		// The DR-1001 bug: claude-* must match every concrete claude model.
		{"wildcard claude-* matches opus", limitsOf("claude-*"), "claude-opus-4-8", true},
		{"wildcard claude-* matches sonnet", limitsOf("claude-*"), "claude-sonnet-4-6", true},
		{"wildcard claude-* matches haiku", limitsOf("claude-*"), "claude-haiku-4-5-20251001", true},
		{"wildcard claude-* rejects gpt", limitsOf("claude-*"), "gpt-4o-mini", false},

		// No-dash trailing star (the UI also emits gpt-4o*).
		{"wildcard gpt-4o* matches mini", limitsOf("gpt-4o*"), "gpt-4o-mini", true},
		{"wildcard gpt-4o* matches bare", limitsOf("gpt-4o*"), "gpt-4o", true},
		{"wildcard gpt-4o* rejects gpt-4-turbo", limitsOf("gpt-4o*"), "gpt-4-turbo", false},

		// A literal "claude-*" with no star handling must NOT prefix-match.
		{"non-wildcard entry is exact only", limitsOf("claude"), "claude-opus-4-8", false},

		// Bare "*" allows anything (still bounded by account ability — see PRD §5).
		{"bare star matches anything", limitsOf("*"), "anything-at-all", true},

		// Mixed list: exact + wildcard coexist.
		{"mixed list exact hit", limitsOf("gpt-4o", "claude-*"), "gpt-4o", true},
		{"mixed list wildcard hit", limitsOf("gpt-4o", "claude-*"), "claude-opus-4-8", true},
		{"mixed list miss", limitsOf("gpt-4o", "claude-*"), "gemini-2.5-pro", false},

		// Empty whitelist permits nothing.
		{"empty map", map[string]bool{}, "claude-opus-4-8", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := MatchModelLimit(tc.limits, tc.model); got != tc.want {
				t.Errorf("MatchModelLimit(%v, %q) = %v, want %v", tc.limits, tc.model, got, tc.want)
			}
		})
	}
}
