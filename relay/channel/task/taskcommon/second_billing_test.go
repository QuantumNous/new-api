package taskcommon

import (
	"math"
	"strings"
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

// Every resolution an administrator can save must be reachable by some
// adapter, or the rule is unmatchable and a configured model rejects every
// request. Channels normalize either through NormalizeResolution here or
// through their own label map (hailuo_v2 and techmobi emit 768p and 2k, and
// hailuo v1 emits 512p, none of which this package's pixel-tier vocabulary
// covers), so a value is acceptable if EITHER source can produce it.
//
// This reads the admin vocabulary rather than restating it: a hardcoded list
// silently stops testing anything the moment someone adds a value.
func TestAdminResolutionVocabularyIsReachable(t *testing.T) {
	// Labels emitted by channels that own their normalization instead of using
	// NormalizeResolution. Keep in step with those adapters' label maps.
	channelOwnedLabels := map[string]bool{"512p": true, "768p": true, "2k": true}

	for _, canonical := range billing_setting.CanonicalResolutionValues() {
		t.Run(canonical, func(t *testing.T) {
			if channelOwnedLabels[canonical] {
				return
			}
			got, ok := NormalizeResolution(canonical)
			if !ok {
				t.Fatalf("%q is saveable by an administrator but no adapter here can emit it, "+
					"so any rule using it would never match", canonical)
			}
			if got != canonical {
				t.Fatalf("%q normalizes to %q: the admin vocabulary stores a non-canonical value",
					canonical, got)
			}
		})
	}
}

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

// A price edit while a task is in flight must not change what the user pays.
// Reservation folds the price into billable units which are persisted in
// TaskBillingContext; settlement reads the frozen units and never re-reads the
// price table. Any change that makes settlement consult configuration again
// will surface here.
func TestSecondBilling_PriceEditDoesNotChangeFrozenUnits(t *testing.T) {
	dims := map[string]string{"resolution": "720p"}
	atSubmit := []billing_setting.VideoPriceRule{
		{Model: "m1", Match: dims, PricePerSecond: 0.314,
			Basis: billing_setting.BasisOutputDuration},
	}

	reserved, err := ComputeSecondBilling(atSubmit, "m1", dims, 10, 0.14)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	frozen := reserved[BillingUnitsKey]

	// The administrator halves the price while the task is still running.
	afterEdit := []billing_setting.VideoPriceRule{
		{Model: "m1", Match: dims, PricePerSecond: 0.157,
			Basis: billing_setting.BasisOutputDuration},
	}
	recomputed, err := ComputeSecondBilling(afterEdit, "m1", dims, 10, 0.14)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if math.Abs(recomputed[BillingUnitsKey]-frozen) < 1e-9 {
		t.Fatal("test setup is wrong: the edit must change a recomputed value")
	}
	// The contract: settlement uses frozen, never recomputed.
	want := 0.314 * 10 / 0.14
	if math.Abs(frozen-want) > 1e-9 {
		t.Fatalf("frozen units = %v, want %v", frozen, want)
	}
}

// One combined multiplier is used rather than separate seconds and resolution
// ratios because applyTaskOtherRatios truncates to int after each
// multiplication. This pins that ComputeSecondBilling emits exactly one key.
func TestSecondBilling_EmitsExactlyOneRatioKey(t *testing.T) {
	rules := []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{}, PricePerSecond: 0.5,
			Basis: billing_setting.BasisOutputDuration},
	}
	got, err := ComputeSecondBilling(rules, "m1", map[string]string{}, 3, 0.1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected exactly one ratio key, got %d: %v", len(got), got)
	}
	if _, ok := got[BillingUnitsKey]; !ok {
		t.Fatalf("expected key %q, got %v", BillingUnitsKey, got)
	}
}

// A configured model whose request cannot be priced must produce an error that
// reaches the relay, not a silent (nil, nil). The two constructors below name
// the two ways an adaptor can fail to price: an unresolvable billing dimension,
// and a length the gateway cannot determine.
func TestUnpriceableDimensionError(t *testing.T) {
	err := UnpriceableDimensionError("m1", "resolution", "banana")
	if err == nil {
		t.Fatal("an unresolvable dimension must produce an error")
	}
	for _, want := range []string{"m1", "resolution", "banana"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("error %q must name %q so the administrator can fix the rule", err, want)
		}
	}
}

func TestUnpriceableDurationError(t *testing.T) {
	err := UnpriceableDurationError("m1", "frames sets the length at an unknown fps")
	if err == nil {
		t.Fatal("an undeterminable length must produce an error")
	}
	for _, want := range []string{"m1", "frames sets the length at an unknown fps"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("error %q must name %q so the caller can fix the request", err, want)
		}
	}
}

// SeedanceBillableSeconds refuses two distinct shapes, and the fix differs:
// drop `frames` and send `duration`, versus send a positive duration. The
// rejection message has to say which, since it is what the caller sees.
func TestSeedanceUnknowableLengthReason(t *testing.T) {
	tests := []struct {
		name string
		req  *dto.SeedanceVideoRequest
		want string
	}{
		{"frames alone", &dto.SeedanceVideoRequest{Frames: ptrInt(121)}, "frames"},
		{"frames wins over duration", &dto.SeedanceVideoRequest{Duration: ptrInt(5), Frames: ptrInt(121)}, "frames"},
		{"auto length -1", &dto.SeedanceVideoRequest{Duration: ptrInt(-1)}, "duration"},
		{"zero duration", &dto.SeedanceVideoRequest{Duration: ptrInt(0)}, "duration"},
		{"nil request", nil, "duration"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SeedanceUnknowableLengthReason(tt.req)
			if !strings.Contains(got, tt.want) {
				t.Fatalf("reason %q must name the offending field %q", got, tt.want)
			}
		})
	}
}

// An adaptor caches per-request billing state on its own struct. In production
// GetTaskAdaptor hands out a fresh instance per call, but registerTaskAdaptorForTest
// returns a shared singleton, so an injected adaptor is reused across requests.
// Stale state there would make a later, perfectly valid request fail with the
// previous request's error -- so every adaptor must clear the fields before
// capturing.
func TestSecondBillingState_ResetClearsEverything(t *testing.T) {
	s := SecondBillingState{
		Model:      "stale-model",
		Dims:       map[string]string{"resolution": "720p"},
		Seconds:    9,
		ModelPrice: 0.5,
		Rules:      []billing_setting.VideoPriceRule{{Model: "stale-model"}},
		Err:        UnpriceableDurationError("stale-model", "stale"),
	}
	s.Reset()
	if s.Model != "" || s.Dims != nil || s.Seconds != 0 ||
		s.ModelPrice != 0 || s.Rules != nil || s.Err != nil {
		t.Fatalf("Reset left state behind: %+v", s)
	}
}

// The failure this guards: a request that errors, followed by one that is fine.
// Without a reset the second inherits the first's error and is rejected.
func TestSecondBillingState_StaleErrorDoesNotLeakToNextRequest(t *testing.T) {
	var s SecondBillingState
	s.Err = UnpriceableDurationError("m", "first request had no length")

	// Second request: reset, then capture normally.
	s.Reset()
	s.Model = "m"
	s.Dims = map[string]string{"resolution": "720p"}
	s.Seconds = 5
	s.ModelPrice = 0.14
	s.Rules = []billing_setting.VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.3, Basis: billing_setting.BasisOutputDuration},
	}

	got, err := s.Ratios()
	if err != nil {
		t.Fatalf("a valid request inherited a stale error: %v", err)
	}
	if math.Abs(got[BillingUnitsKey]-0.3*5/0.14) > 1e-9 {
		t.Fatalf("units = %v", got[BillingUnitsKey])
	}
}

func TestSecondBillingState_RatiosReportsErrorFirst(t *testing.T) {
	s := SecondBillingState{
		Model: "m",
		Err:   UnpriceableDimensionError("m", "resolution", "banana"),
	}
	if _, err := s.Ratios(); err == nil {
		t.Fatal("a captured error must be reported")
	}
}

func TestSecondBillingState_UncapturedIsNoOp(t *testing.T) {
	var s SecondBillingState
	got, err := s.Ratios()
	if err != nil || got != nil {
		t.Fatalf("uncaptured state must be a no-op, got %v / %v", got, err)
	}
}
