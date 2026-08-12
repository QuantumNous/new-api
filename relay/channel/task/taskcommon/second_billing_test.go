package taskcommon

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/billing_setting"
)

func ptrInt(i int) *int { return &i }

// The seedance duration is optional, may be -1 ("let the model decide"), and
// has a sibling `frames` field the upstream may honour instead. Only a length
// the gateway can actually know may be billed; every other shape must report
// false so the calling adaptor skips capture rather than pricing a guessed
// length. Shared by doubao and byteplus, which both submit to Ark.
func TestSeedanceBillableSeconds(t *testing.T) {
	tests := []struct {
		name     string
		duration *int
		frames   *int
		want     float64
		wantOK   bool
	}{
		{name: "absent defaults to 5s", want: 5, wantOK: true},
		{name: "explicit 10s", duration: ptrInt(10), want: 10, wantOK: true},
		{name: "auto length -1 is unknowable", duration: ptrInt(-1)},
		{name: "zero is unknowable", duration: ptrInt(0)},
		{name: "frames alone is unknowable", frames: ptrInt(121)},
		{name: "frames alongside duration is unknowable", duration: ptrInt(5), frames: ptrInt(121)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := dto.SeedanceVideoRequest{Duration: tt.duration, Frames: tt.frames}
			got, ok := SeedanceBillableSeconds(&req)
			if ok != tt.wantOK {
				t.Fatalf("SeedanceBillableSeconds ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && got != tt.want {
				t.Fatalf("SeedanceBillableSeconds = %v, want %v", got, tt.want)
			}
		})
	}
}

// A nil request has no knowable length; reporting true would make the caller
// bill 5 seconds for a request it could not even parse.
func TestSeedanceBillableSeconds_NilIsUnknowable(t *testing.T) {
	if _, ok := SeedanceBillableSeconds(nil); ok {
		t.Fatal("nil request must not resolve to a billable length")
	}
}

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

// The admin-facing normalizer in billing_setting duplicates this vocabulary,
// because taskcommon imports billing_setting and the dependency cannot run the
// other way. If the two drift, a rule an administrator saves successfully can
// become permanently unmatchable. This pins the pairing from this side.
func TestNormalizeResolution_MatchesAdminVocabulary(t *testing.T) {
	adminAccepts := []string{"480p", "720p", "1080p", "4k", "2160p"}
	for _, in := range adminAccepts {
		t.Run(in, func(t *testing.T) {
			got, ok := NormalizeResolution(in)
			if !ok {
				t.Fatalf("%q is accepted by the admin normalizer but rejected here", in)
			}
			folded, _ := NormalizeResolution(got)
			if folded != got {
				t.Fatalf("%q normalizes to %q which is not itself canonical", in, got)
			}
		})
	}
}
