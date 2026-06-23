package tiers

import "testing"

func TestValidAndResolve(t *testing.T) {
	for _, name := range []string{"smart-tier", "balanced-tier", "fast-tier"} {
		if !Valid(name) {
			t.Fatalf("expected %q to be a valid tier", name)
		}
		if model, ok := Resolve(name); !ok || model == "" {
			t.Fatalf("expected %q to resolve to a concrete model, got %q ok=%v", name, model, ok)
		}
	}
	if Valid("gpt-4-0613") {
		t.Fatal("hardcoded provider model must not be a valid tier alias")
	}
	if _, ok := Resolve("nope-tier"); ok {
		t.Fatal("unknown tier must not resolve")
	}
}

func TestValidateWhitelist(t *testing.T) {
	if _, ok := ValidateWhitelist([]string{"smart-tier", "balanced-tier"}); !ok {
		t.Fatal("valid tier list should pass")
	}
	if bad, ok := ValidateWhitelist([]string{"smart-tier", "claude-3-opus-20240229"}); ok || bad != "claude-3-opus-20240229" {
		t.Fatalf("hardcoded model should be rejected, got bad=%q ok=%v", bad, ok)
	}
	if _, ok := ValidateWhitelist(nil); ok {
		t.Fatal("empty whitelist must be rejected")
	}
}

func TestResolvedModelsNonEmpty(t *testing.T) {
	if len(ResolvedModels()) == 0 {
		t.Fatal("expected at least one resolved model")
	}
	if len(List()) < 3 {
		t.Fatalf("expected at least 3 tiers, got %v", List())
	}
}
