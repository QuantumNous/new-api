package billing_setting

import "testing"

func TestValidateVideoPriceRules_AcceptsValidRules(t *testing.T) {
	rules := []VideoPriceRule{
		{
			Model:          "m1",
			Match:          map[string]string{"resolution": "720p"},
			PricePerSecond: 0.314,
			Basis:          BasisOutputDuration,
		},
		{
			Model:           "m1",
			Match:           map[string]string{"resolution": "720p", "has_video": "true"},
			PricePerSecond:  0.188,
			Basis:           BasisTotalDuration,
			FallbackSeconds: 30,
		},
	}
	if err := ValidateVideoPriceRules(rules); err != nil {
		t.Fatalf("expected valid rules, got error: %v", err)
	}
}

func TestValidateVideoPriceRules_RejectsInvalid(t *testing.T) {
	cases := []struct {
		name  string
		rules []VideoPriceRule
	}{
		{"empty model", []VideoPriceRule{
			{Model: "", PricePerSecond: 1, Basis: BasisOutputDuration},
		}},
		{"zero price", []VideoPriceRule{
			{Model: "m", PricePerSecond: 0, Basis: BasisOutputDuration},
		}},
		{"negative price", []VideoPriceRule{
			{Model: "m", PricePerSecond: -1, Basis: BasisOutputDuration},
		}},
		{"unknown basis", []VideoPriceRule{
			{Model: "m", PricePerSecond: 1, Basis: "weekly"},
		}},
		{"total_duration without fallback", []VideoPriceRule{
			{Model: "m", PricePerSecond: 1, Basis: BasisTotalDuration},
		}},
		{"ambiguous same constraint count", []VideoPriceRule{
			{Model: "m", Match: map[string]string{"resolution": "720p"},
				PricePerSecond: 1, Basis: BasisOutputDuration},
			{Model: "m", Match: map[string]string{"has_video": "true"},
				PricePerSecond: 2, Basis: BasisOutputDuration},
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := ValidateVideoPriceRules(tc.rules); err == nil {
				t.Fatalf("expected rejection for %s", tc.name)
			}
		})
	}
}

func TestValidateVideoPriceRules_AllowsDifferentModelsToOverlap(t *testing.T) {
	rules := []VideoPriceRule{
		{Model: "a", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 1, Basis: BasisOutputDuration},
		{Model: "b", Match: map[string]string{"has_video": "true"},
			PricePerSecond: 2, Basis: BasisOutputDuration},
	}
	if err := ValidateVideoPriceRules(rules); err != nil {
		t.Fatalf("different models must not collide: %v", err)
	}
}

func TestValidateVideoPriceRules_AllowsMutuallyExclusiveSameCount(t *testing.T) {
	// The real Seedance 2.5 shape: a 2x2 matrix where every rule has two
	// constraints and no two rules can match the same request.
	rules := []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "480p", "has_video": "false"},
			PricePerSecond: 0.140, Basis: BasisOutputDuration},
		{Model: "m", Match: map[string]string{"resolution": "720p", "has_video": "false"},
			PricePerSecond: 0.314, Basis: BasisOutputDuration},
		{Model: "m", Match: map[string]string{"resolution": "480p", "has_video": "true"},
			PricePerSecond: 0.084, Basis: BasisTotalDuration, FallbackSeconds: 30},
		{Model: "m", Match: map[string]string{"resolution": "720p", "has_video": "true"},
			PricePerSecond: 0.188, Basis: BasisTotalDuration, FallbackSeconds: 30},
	}
	if err := ValidateVideoPriceRules(rules); err != nil {
		t.Fatalf("mutually exclusive rules must be accepted: %v", err)
	}
}

func TestValidateVideoPriceRules_RejectsOverlappingSameCount(t *testing.T) {
	// Disjoint constraint keys: a request with resolution=720p AND
	// has_video=true satisfies both, with no principled winner.
	rules := []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 1, Basis: BasisOutputDuration},
		{Model: "m", Match: map[string]string{"has_video": "true"},
			PricePerSecond: 2, Basis: BasisOutputDuration},
	}
	if err := ValidateVideoPriceRules(rules); err == nil {
		t.Fatal("overlapping equal-count rules must be rejected")
	}
}

func TestValidateVideoPriceRules_RejectsIdenticalMatch(t *testing.T) {
	rules := []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 1, Basis: BasisOutputDuration},
		{Model: "m", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 2, Basis: BasisOutputDuration},
	}
	if err := ValidateVideoPriceRules(rules); err == nil {
		t.Fatal("identical match maps must be rejected")
	}
}

func TestFindVideoPriceRule(t *testing.T) {
	rules := []VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "720p", "has_video": "true"},
			PricePerSecond: 0.188, Basis: BasisTotalDuration, FallbackSeconds: 30},
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.314, Basis: BasisOutputDuration},
		{Model: "m1", Match: map[string]string{},
			PricePerSecond: 0.1, Basis: BasisOutputDuration},
	}

	tests := []struct {
		name      string
		model     string
		dims      map[string]string
		wantPrice float64
		wantFound bool
	}{
		{"most constrained wins", "m1",
			map[string]string{"resolution": "720p", "has_video": "true"}, 0.188, true},
		{"falls to less constrained", "m1",
			map[string]string{"resolution": "720p", "has_video": "false"}, 0.314, true},
		{"empty match is wildcard", "m1",
			map[string]string{"resolution": "480p"}, 0.1, true},
		{"unknown model not found", "other",
			map[string]string{"resolution": "720p"}, 0, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := FindVideoPriceRule(rules, tc.model, tc.dims)
			if ok != tc.wantFound {
				t.Fatalf("found = %v, want %v", ok, tc.wantFound)
			}
			if ok && got.PricePerSecond != tc.wantPrice {
				t.Fatalf("price = %v, want %v", got.PricePerSecond, tc.wantPrice)
			}
		})
	}
}

func TestFindVideoPriceRule_UnresolvedDimensionNeverMatches(t *testing.T) {
	// A rule constrains "fps", but no adapter emits it yet.
	rules := []VideoPriceRule{
		{Model: "m1", Match: map[string]string{"fps": "30"},
			PricePerSecond: 1, Basis: BasisOutputDuration},
	}
	if _, ok := FindVideoPriceRule(rules, "m1", map[string]string{"resolution": "720p"}); ok {
		t.Fatal("a rule constraining an unresolved dimension must not match")
	}
}

func TestFindVideoPriceRule_ModelConfiguredCheck(t *testing.T) {
	rules := []VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 1, Basis: BasisOutputDuration},
	}
	if !IsVideoModelConfigured(rules, "m1") {
		t.Fatal("m1 must report as configured")
	}
	if IsVideoModelConfigured(rules, "m2") {
		t.Fatal("m2 must report as unconfigured")
	}
}

func TestFindVideoPriceRule_NoRulesAtAll(t *testing.T) {
	if _, ok := FindVideoPriceRule(nil, "m1", map[string]string{"resolution": "720p"}); ok {
		t.Fatal("an empty rule set must not match")
	}
	if IsVideoModelConfigured(nil, "m1") {
		t.Fatal("an empty rule set must report nothing configured")
	}
}

func TestFindVideoPriceRule_NilDimensions(t *testing.T) {
	rules := []VideoPriceRule{
		{Model: "m1", Match: map[string]string{}, PricePerSecond: 0.5, Basis: BasisOutputDuration},
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 1, Basis: BasisOutputDuration},
	}
	// Nil dimensions satisfy only an unconstrained rule.
	got, ok := FindVideoPriceRule(rules, "m1", nil)
	if !ok {
		t.Fatal("a wildcard rule must match nil dimensions")
	}
	if got.PricePerSecond != 0.5 {
		t.Fatalf("price = %v, want 0.5", got.PricePerSecond)
	}
}
