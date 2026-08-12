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

func TestNormalizeResolution(t *testing.T) {
	tests := []struct {
		in   string
		want string
		ok   bool
	}{
		{"720p", "720p", true},
		{"720P", "720p", true},
		{"  1080p  ", "1080p", true},
		{"4K", "4k", true},
		{"2160p", "4k", true},
		{"480p", "480p", true},
		{"1792x1024", "1080p", true},
		{"1024x1792", "1080p", true},
		{"1280x720", "720p", true},
		{"720x1280", "720p", true},
		{"854x480", "480p", true},
		{"3840x2160", "4k", true},
		{"", "", false},
		{"banana", "", false},
		{"999x999", "", false},
	}
	for _, tc := range tests {
		t.Run(tc.in, func(t *testing.T) {
			got, ok := NormalizeResolution(tc.in)
			if ok != tc.ok {
				t.Fatalf("ok = %v, want %v", ok, tc.ok)
			}
			if got != tc.want {
				t.Fatalf("got %q, want %q", got, tc.want)
			}
		})
	}
}

func TestNormalizeResolution_MalformedDimensions(t *testing.T) {
	// Anything that cannot be classified must be refused rather than guessed.
	for _, in := range []string{"x", "1280x", "x720", "1280x720x30", "-1280x720", "0x0", "abcxdef", "1280*720"} {
		t.Run(in, func(t *testing.T) {
			if _, ok := NormalizeResolution(in); ok {
				t.Fatalf("%q must not classify", in)
			}
		})
	}
}

// Short sides are matched exactly, so the dimension strings channels actually
// send are pinned here: a missing anchor rejects a real request rather than
// mispricing it, which makes this the regression guard for that trade-off.
func TestNormalizeResolution_ChannelEmittedDimensions(t *testing.T) {
	cases := map[string]string{
		// sora sizes (relay/channel/task/sora/adaptor.go)
		"720x1280":  "720p",
		"1280x720":  "720p",
		"1792x1024": "1080p",
		"1024x1792": "1080p",
		// kling sizes (relay/channel/task/kling/adaptor.go)
		"1920x1080": "1080p",
		"1080x1920": "1080p",
		// uppercase separator is as legitimate as an uppercase label
		"3840X2160": "4k",
	}
	for in, want := range cases {
		t.Run(in, func(t *testing.T) {
			got, ok := NormalizeResolution(in)
			if !ok {
				t.Fatalf("%q must classify as %q", in, want)
			}
			if got != want {
				t.Fatalf("got %q, want %q", got, want)
			}
		})
	}
}
