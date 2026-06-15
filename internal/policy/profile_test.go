package policy

import "testing"

func TestDecisionFor_KidsModeForcesEverything(t *testing.T) {
	d := DecisionFor(true, "passthrough") // even with passthrough profile
	if !d.KidsMode || !d.EnforceModelWhitelist || !d.EnforceZDR || !d.InjectSystemPrompt || !d.StripIdentifying || !d.RunInputFilter {
		t.Errorf("KidsMode=true must force ALL hard constraints, got %+v", d)
	}
}

func TestDecisionFor_KidSafeProfile(t *testing.T) {
	d := DecisionFor(false, "kid-safe")
	if d.KidsMode {
		t.Errorf("KidsMode flag must remain false when only profile is kid-safe")
	}
	if !d.EnforceModelWhitelist || !d.EnforceZDR || !d.InjectSystemPrompt || !d.StripIdentifying || !d.RunInputFilter {
		t.Errorf("kid-safe profile must apply all kid-safe constraints, got %+v", d)
	}
}

func TestDecisionFor_DefaultsToPassthrough(t *testing.T) {
	d := DecisionFor(false, "")
	if d.Profile != ProfilePassthrough {
		t.Errorf("empty profile must default to passthrough, got %v", d.Profile)
	}
	if d.EnforceModelWhitelist || d.EnforceZDR || d.InjectSystemPrompt || d.StripIdentifying || d.RunInputFilter {
		t.Errorf("passthrough must NOT enforce any kid constraints, got %+v", d)
	}
}

func TestDecisionFor_AdultProfile(t *testing.T) {
	d := DecisionFor(false, "adult")
	if d.Profile != ProfileAdult {
		t.Errorf("expected adult profile, got %v", d.Profile)
	}
	if !d.InjectSystemPrompt {
		t.Errorf("adult profile must inject the adult profile system prompt")
	}
	if !d.RunInputFilter {
		t.Errorf("adult profile must run the narrow input filter")
	}
}

func TestDecisionFor_UnknownProfileFallsBack(t *testing.T) {
	d := DecisionFor(false, "garbage-profile")
	if d.Profile != ProfilePassthrough {
		t.Errorf("unknown profile must fall back to passthrough, got %v", d.Profile)
	}
}
