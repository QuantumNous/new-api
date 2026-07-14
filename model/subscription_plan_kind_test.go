package model

import "testing"

func TestParsePlanKind(t *testing.T) {
	cases := []struct {
		in      string
		want    string
		wantOK  bool
	}{
		{in: "base", want: SubscriptionPlanKindBase, wantOK: true},
		{in: "BASE", want: SubscriptionPlanKindBase, wantOK: true},
		{in: " booster ", want: SubscriptionPlanKindBooster, wantOK: true},
		{in: "hidden", want: SubscriptionPlanKindHidden, wantOK: true},
		{in: "", want: "", wantOK: false},
		{in: "unknown", want: "", wantOK: false},
	}
	for _, tc := range cases {
		got, ok := ParsePlanKind(tc.in)
		if ok != tc.wantOK || got != tc.want {
			t.Fatalf("ParsePlanKind(%q) = (%q, %v), want (%q, %v)", tc.in, got, ok, tc.want, tc.wantOK)
		}
	}
}

func TestNormalizePlanKind(t *testing.T) {
	if got := NormalizePlanKind(""); got != SubscriptionPlanKindBase {
		t.Fatalf("empty should be base, got %q", got)
	}
	if got := NormalizePlanKind("booster"); got != SubscriptionPlanKindBooster {
		t.Fatalf("booster mismatch: %q", got)
	}
	if got := NormalizePlanKind("nope"); got != SubscriptionPlanKindBase {
		t.Fatalf("unknown should fall back to base, got %q", got)
	}
}

func TestEnsurePlanKind(t *testing.T) {
	plan := &SubscriptionPlan{PlanKind: ""}
	plan.EnsurePlanKind()
	if plan.PlanKind != SubscriptionPlanKindBase {
		t.Fatalf("EnsurePlanKind empty = %q, want base", plan.PlanKind)
	}
}
