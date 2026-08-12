package taskcommon

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/setting/billing_setting"
)

func TestComputeSecondBilling_OutputDuration(t *testing.T) {
	rules := []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.314, Basis: billing_setting.BasisOutputDuration},
	}
	// modelPrice 0.14 is the calculation base; units fold the whole
	// per-second calculation into one multiplier.
	got, err := ComputeSecondBilling(rules, "m1",
		map[string]string{"resolution": "720p"}, 5, 0.14)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := 0.314 * 5 / 0.14
	if math.Abs(got[BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[BillingUnitsKey], want)
	}
}

func TestComputeSecondBilling_TotalDurationUsesFallback(t *testing.T) {
	rules := []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"has_video": "true"},
			PricePerSecond: 0.188, Basis: billing_setting.BasisTotalDuration,
			FallbackSeconds: 30},
	}
	// Reference video duration is unknowable locally, so the bounded
	// fallback replaces the requested seconds entirely.
	got, err := ComputeSecondBilling(rules, "m1",
		map[string]string{"has_video": "true"}, 5, 0.14)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := 0.188 * 30 / 0.14
	if math.Abs(got[BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[BillingUnitsKey], want)
	}
}

func TestComputeSecondBilling_ConfiguredModelWithNoMatchErrors(t *testing.T) {
	rules := []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.314, Basis: billing_setting.BasisOutputDuration},
	}
	_, err := ComputeSecondBilling(rules, "m1",
		map[string]string{"resolution": "4k"}, 5, 0.14)
	if err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

func TestComputeSecondBilling_UnconfiguredModelReturnsNoUnits(t *testing.T) {
	rules := []billing_setting.VideoPriceRule{
		{Model: "other", Match: map[string]string{},
			PricePerSecond: 1, Basis: billing_setting.BasisOutputDuration},
	}
	got, err := ComputeSecondBilling(rules, "m1",
		map[string]string{"resolution": "720p"}, 5, 0.14)
	if err != nil {
		t.Fatalf("unconfigured model must not error, got %v", err)
	}
	if got != nil {
		t.Fatalf("unconfigured model must return nil units, got %v", got)
	}
}

func TestComputeSecondBilling_RejectsBadInputs(t *testing.T) {
	rules := []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{},
			PricePerSecond: 0.314, Basis: billing_setting.BasisOutputDuration},
	}
	cases := []struct {
		name       string
		seconds    float64
		modelPrice float64
	}{
		{"zero seconds", 0, 0.14},
		{"negative seconds", -1, 0.14},
		{"zero model price", 5, 0},
		{"negative model price", 5, -1},
		{"NaN model price", 5, math.NaN()},
		{"Inf model price", 5, math.Inf(1)},
		{"NaN seconds", math.NaN(), 0.14},
		{"Inf seconds", math.Inf(1), 0.14},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := ComputeSecondBilling(rules, "m1",
				map[string]string{}, tc.seconds, tc.modelPrice); err == nil {
				t.Fatalf("expected error for %s", tc.name)
			}
		})
	}
}

func TestComputeSecondBilling_DoesNotMutateMatch(t *testing.T) {
	// The rules slice from GetVideoPriceRules is a shallow copy: Match maps
	// are shared with the live table and must be treated as read-only.
	shared := map[string]string{"resolution": "720p"}
	rules := []billing_setting.VideoPriceRule{
		{Model: "m1", Match: shared,
			PricePerSecond: 0.314, Basis: billing_setting.BasisOutputDuration},
	}
	if _, err := ComputeSecondBilling(rules, "m1",
		map[string]string{"resolution": "720p"}, 5, 0.14); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(shared) != 1 || shared["resolution"] != "720p" {
		t.Fatalf("Match was mutated: %v", shared)
	}
}
