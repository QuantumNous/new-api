// Package tiers is the platform model-alias registry for Skill model_whitelist
// values (D-09 compliance rule 2, DR-110 validation, DR-96 resolution).
//
// A Skill declares a TIER (a routing-group alias such as "smart-tier"), never a
// concrete provider/model id. The Smart Router resolves the alias to the current
// best model at routing time; when a provider deprecates a model version, only
// this registry is updated — no individual Skill or skill_versions row changes.
//
// Two responsibilities live here and ONLY here (server-side):
//
//   - DR-110: ValidateWhitelist rejects model_whitelist entries that are not
//     registered tier aliases (e.g. hardcoded "gpt-4-0613"), enforced at Skill
//     draft/version creation.
//   - DR-96: Resolve maps a tier alias to the concrete model the gateway routes
//     to. This mapping is platform IP and must NEVER ship inside a downloadable
//     package (see internal/skill/packaging guard) — the moat is that the
//     download client knows only the tier, never the resolution.
package tiers

import "sort"

// Tier is a platform routing-group alias used in Skill model_whitelist.
type Tier string

const (
	// SmartTier routes to the highest-capability model. Correctness/quality first.
	SmartTier Tier = "smart-tier"
	// BalancedTier trades a little capability for lower cost/latency.
	BalancedTier Tier = "balanced-tier"
	// FastTier routes to the lowest-latency/cheapest model for short/generic work.
	FastTier Tier = "fast-tier"
	// KidsSafeTier is reserved for Kids-mode Skills (not used by the R2 demo set).
	KidsSafeTier Tier = "kids-safe-tier"
)

// resolution maps each registered tier alias to the concrete model the gateway
// currently routes it to. This is the single global mapping referenced by the
// data-model spec §4.1: a provider deprecation updates only this table.
//
// SERVER-SIDE ONLY. These concrete model ids must never appear in a downloadable
// package — the packaging build-time guard asserts their absence.
var resolution = map[Tier]string{
	SmartTier:    "claude-opus-4-8",
	BalancedTier: "claude-sonnet-4-7",
	FastTier:     "claude-haiku-4-5",
	KidsSafeTier: "claude-sonnet-4-7",
}

// Valid reports whether name is a registered platform tier alias.
func Valid(name string) bool {
	_, ok := resolution[Tier(name)]
	return ok
}

// Resolve returns the concrete model id a tier alias routes to (DR-96).
// Returns ("", false) for an unregistered alias.
func Resolve(name string) (string, bool) {
	model, ok := resolution[Tier(name)]
	return model, ok
}

// List returns all registered tier aliases in sorted order.
func List() []string {
	out := make([]string, 0, len(resolution))
	for t := range resolution {
		out = append(out, string(t))
	}
	sort.Strings(out)
	return out
}

// ResolvedModels returns the concrete model ids referenced by the registry, in
// sorted order. Used by the packaging guard to assert none of them leak into a
// downloadable package (the resolution map is server-side platform IP).
func ResolvedModels() []string {
	seen := make(map[string]struct{}, len(resolution))
	for _, m := range resolution {
		seen[m] = struct{}{}
	}
	out := make([]string, 0, len(seen))
	for m := range seen {
		out = append(out, m)
	}
	sort.Strings(out)
	return out
}

// ValidateWhitelist enforces DR-110: every entry must be a registered tier
// alias and the list must be non-empty. Returns the first offending value and
// false when invalid; ("", true) when the whole list is valid.
func ValidateWhitelist(whitelist []string) (bad string, ok bool) {
	if len(whitelist) == 0 {
		return "", false
	}
	for _, w := range whitelist {
		if !Valid(w) {
			return w, false
		}
	}
	return "", true
}
