package skillrelay

import (
	"testing"

	"github.com/QuantumNous/new-api/internal/skill/tiers"
)

// selectModel must resolve a platform tier alias to the concrete model the gateway
// routes to (DR-96), so Skills that declare tiers (e.g. the DR-51 demo set) route
// to a real model instead of trying to call a provider named "smart-tier".
func TestSelectModel_ResolvesTierAlias(t *testing.T) {
	want, ok := tiers.Resolve("smart-tier")
	if !ok {
		t.Fatal("precondition: smart-tier must resolve in the registry")
	}
	got, code := selectModel([]string{"smart-tier", "balanced-tier"})
	if code != "" {
		t.Fatalf("unexpected error code %q", code)
	}
	if got != want {
		t.Fatalf("smart-tier should resolve to %q, got %q", want, got)
	}
}

// A literal (non-alias) model id must pass through unchanged — backward compatible
// with whitelists authored before the tier registry.
func TestSelectModel_LiteralModelPassesThrough(t *testing.T) {
	got, code := selectModel([]string{"gpt-4o"})
	if code != "" || got != "gpt-4o" {
		t.Fatalf("literal model should pass through, got %q code %q", got, code)
	}
}

// The first non-empty entry wins; empty strings are skipped.
func TestSelectModel_SkipsEmptyEntries(t *testing.T) {
	got, code := selectModel([]string{"", "fast-tier"})
	want, _ := tiers.Resolve("fast-tier")
	if code != "" || got != want {
		t.Fatalf("expected resolved fast-tier %q, got %q code %q", want, got, code)
	}
}

func TestSelectModel_EmptyWhitelistErrors(t *testing.T) {
	if _, code := selectModel(nil); code == "" {
		t.Fatal("empty whitelist must return an error code")
	}
}
