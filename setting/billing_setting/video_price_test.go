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
