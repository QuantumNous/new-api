package model

import "testing"

func TestDefaultVendorRulesRecognizeMiniMaxModelNames(t *testing.T) {
	if got := defaultVendorRules["minimax"]; got != "MiniMax" {
		t.Fatalf("defaultVendorRules[minimax] = %q, want MiniMax", got)
	}
}
