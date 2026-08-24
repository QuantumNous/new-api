package billing_setting

import (
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// config.updateRegisteredConfig type-asserts the registered value against its
// unexported normalizingConfig interface, and the value registered in init is a
// *VideoPriceSetting. Should the method set ever move off the pointer, that
// assertion silently stops matching and every rule set loads unvalidated, so
// pin the receiver shape at compile time.
var _ interface{ NormalizeAndValidate() error } = (*VideoPriceSetting)(nil)

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

func TestVideoPriceSettingNormalizeAndValidate_AcceptsValidRules(t *testing.T) {
	s := VideoPriceSetting{VideoPriceRules: []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.314, Basis: BasisOutputDuration},
		{Model: "m", Match: map[string]string{"resolution": "720p", "has_video": "true"},
			PricePerSecond: 0.188, Basis: BasisTotalDuration, FallbackSeconds: 30},
	}}
	if err := s.NormalizeAndValidate(); err != nil {
		t.Fatalf("expected valid rules to be accepted, got: %v", err)
	}
}

func TestVideoPriceSettingNormalizeAndValidate_QuarantinesInvalidRules(t *testing.T) {
	cases := []struct {
		name  string
		rules []VideoPriceRule
	}{
		{"zero price", []VideoPriceRule{
			{Model: "m", PricePerSecond: 0, Basis: BasisOutputDuration},
		}},
		{"ambiguous overlap", []VideoPriceRule{
			{Model: "m", Match: map[string]string{"resolution": "720p"},
				PricePerSecond: 1, Basis: BasisOutputDuration},
			{Model: "m", Match: map[string]string{"has_video": "true"},
				PricePerSecond: 2, Basis: BasisOutputDuration},
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := VideoPriceSetting{VideoPriceRules: tc.rules}
			// The load path does not fail: it drops the offending model so the
			// rest of the table keeps serving. The model must end up
			// unconfigured, which returns it to legacy billing.
			if err := s.NormalizeAndValidate(); err != nil {
				t.Fatalf("the load path must not fail the whole set: %v", err)
			}
			if IsVideoModelConfigured(s.VideoPriceRules, "m") {
				t.Fatalf("%s must leave the model unconfigured, got %+v", tc.name, s.VideoPriceRules)
			}
		})
	}
}

// The compile-time assertion above only proves the type has the method. This
// proves the value actually handed to ConfigManager is the pointer, so the
// interface assertion in updateRegisteredConfig succeeds at runtime.
func TestVideoPriceSettingIsRegisteredAsNormalizingConfig(t *testing.T) {
	registered := config.GlobalConfig.Get("billing_setting_video")
	if registered == nil {
		t.Fatal("billing_setting_video must be registered with GlobalConfig")
	}
	if _, ok := registered.(interface{ NormalizeAndValidate() error }); !ok {
		t.Fatalf("registered config %T must satisfy the normalizing config interface", registered)
	}
}

// The property that matters: a rule set that would make matching
// order-dependent must never reach the matcher. The load path quarantines the
// offending model rather than refusing the whole set, so the model ends up
// unconfigured — which returns it cleanly to legacy billing — while every other
// model keeps its pricing. Driven through a private ConfigManager so the real
// clone-then-swap path runs without touching the process-wide config.
func TestVideoPriceSettingLoadFromDBQuarantinesAmbiguousModel(t *testing.T) {
	manager := config.NewConfigManager()
	setting := &VideoPriceSetting{}
	manager.Register("billing_setting_video", setting)

	accepted := []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.314, Basis: BasisOutputDuration},
	}
	if err := manager.LoadFromDB(map[string]string{
		"billing_setting_video.video_price_rules": marshalRules(t, accepted),
	}); err != nil {
		t.Fatalf("LoadFromDB failed: %v", err)
	}
	if len(setting.VideoPriceRules) != 1 || setting.VideoPriceRules[0].PricePerSecond != 0.314 {
		t.Fatalf("rules = %+v, want the valid set applied", setting.VideoPriceRules)
	}

	// Two one-constraint rules on disjoint keys: a 720p request with video
	// satisfies both, so which price is charged would depend on array order.
	// "keep" is well-formed and must survive the other model's problem.
	ambiguous := []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 9, Basis: BasisOutputDuration},
		{Model: "m", Match: map[string]string{"has_video": "true"},
			PricePerSecond: 99, Basis: BasisOutputDuration},
		{Model: "keep", Match: map[string]string{"resolution": "480p"},
			PricePerSecond: 0.1, Basis: BasisOutputDuration},
	}
	if err := manager.LoadFromDB(map[string]string{
		"billing_setting_video.video_price_rules": marshalRules(t, ambiguous),
	}); err != nil {
		t.Fatalf("LoadFromDB failed: %v", err)
	}
	if IsVideoModelConfigured(setting.VideoPriceRules, "m") {
		t.Fatalf("the ambiguous model must be dropped, got %+v", setting.VideoPriceRules)
	}
	if !IsVideoModelConfigured(setting.VideoPriceRules, "keep") {
		t.Fatalf("the well-formed model lost its pricing as collateral, got %+v", setting.VideoPriceRules)
	}
}

func marshalRules(t *testing.T, rules []VideoPriceRule) string {
	t.Helper()
	encoded, err := common.Marshal(rules)
	if err != nil {
		t.Fatalf("failed to encode rules: %v", err)
	}
	return string(encoded)
}

// ConfigManager only takes a module lock around its reflective write when the
// registered value implements these two interfaces (setting/config/config.go
// lockModuleForWrite). Their method sets are pinned here because the swap
// happens inside config.go via reflection, where this package cannot lock.
var (
	_ interface {
		LockConfig()
		UnlockConfig()
	} = (*VideoPriceSetting)(nil)
	_ interface {
		RLockConfig()
		RUnlockConfig()
	} = (*VideoPriceSetting)(nil)
)

// blocksWhile reports whether fn is still running while the caller holds a
// lock, then waits for it to finish once release runs. Deterministic proof that
// fn contends for the same mutex: an unlocked fn returns immediately.
func blocksWhile(t *testing.T, fn func(), release func()) bool {
	t.Helper()
	done := make(chan struct{})
	go func() {
		fn()
		close(done)
	}()

	blocked := false
	select {
	case <-done:
	case <-time.After(100 * time.Millisecond):
		blocked = true
	}

	release()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("call never completed after the lock was released")
	}
	return blocked
}

// The getter must read under the module read lock, or it races the reflective
// swap in config.go. Holding the write lock must therefore stall it.
func TestGetVideoPriceRulesReadsUnderTheModuleLock(t *testing.T) {
	videoPriceSettingMu.Lock()
	blocked := blocksWhile(t, func() { _ = GetVideoPriceRules() }, videoPriceSettingMu.Unlock)
	if !blocked {
		t.Fatal("GetVideoPriceRules returned while the config write lock was held: it is not reading under the lock")
	}
}

// The other half: ConfigManager must hold this package's write lock across its
// reflective swap, which it only does when the registered value implements
// configWriteLocker. Holding the mutex must therefore stall a reload.
func TestLoadFromDBWritesUnderTheModuleLock(t *testing.T) {
	original := GetVideoPriceRules()
	t.Cleanup(func() {
		videoPriceSettingMu.Lock()
		defer videoPriceSettingMu.Unlock()
		videoPriceSetting.VideoPriceRules = original
	})

	manager := config.NewConfigManager()
	manager.Register("billing_setting_video", &videoPriceSetting)
	values := map[string]string{
		"billing_setting_video.video_price_rules": marshalRules(t, []VideoPriceRule{
			{Model: "m", Match: map[string]string{"resolution": "720p"},
				PricePerSecond: 0.314, Basis: BasisOutputDuration},
		}),
	}

	videoPriceSettingMu.Lock()
	blocked := blocksWhile(t, func() {
		if err := manager.LoadFromDB(values); err != nil {
			t.Errorf("LoadFromDB failed: %v", err)
		}
	}, videoPriceSettingMu.Unlock)
	if !blocked {
		t.Fatal("LoadFromDB swapped the config while this package's write lock was held: ConfigManager is not using it")
	}
	if rules := GetVideoPriceRules(); len(rules) != 1 || rules[0].PricePerSecond != 0.314 {
		t.Fatalf("rules = %+v, want the reload applied after the lock was released", rules)
	}
}

// The getter hands out a copy, so a caller mutating what it received -- easy to
// do by accident on a billing path -- cannot corrupt the table every other
// request reads. The copy is shallow: Match maps are still shared, so they stay
// read-only by contract.
func TestGetVideoPriceRulesCallerCannotMutateSharedRules(t *testing.T) {
	original := GetVideoPriceRules()
	t.Cleanup(func() {
		videoPriceSettingMu.Lock()
		defer videoPriceSettingMu.Unlock()
		videoPriceSetting.VideoPriceRules = original
	})

	videoPriceSettingMu.Lock()
	videoPriceSetting.VideoPriceRules = []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.314, Basis: BasisOutputDuration},
	}
	videoPriceSettingMu.Unlock()

	mine := GetVideoPriceRules()
	mine[0].PricePerSecond = 999

	if again := GetVideoPriceRules(); again[0].PricePerSecond != 0.314 {
		t.Fatalf("price = %v, want 0.314: a caller mutated the shared rule table", again[0].PricePerSecond)
	}
}

// GetVideoPriceRules hands out a shallow copy, so each rule's Match map is
// shared with the live table. The worry that follows from that is whether a
// reload can write into a Match map a request is already holding -- which would
// be a data race on the billing path, since normalizeRuleMatch folds values with
// an in-place `r.Match[key] = canonical`.
//
// It cannot, and two independent layers in setting/config/config.go each
// prevent it on their own. Verified by mutation: removing either one alone
// leaves this test passing, removing both makes it fail.
//
//  1. updateConfigFromMap's reflect.Slice branch unmarshals into a freshly
//     allocated slice rather than decoding over the existing one, so every rule
//     element -- and therefore every Match map -- is minted by the decoder.
//     This is the primary guard: without it, encoding/json reuses the existing
//     elements and folds values into maps already handed out.
//  2. updateRegisteredConfig JSON-round-trips the whole setting into a fresh
//     `next` before normalizing, so normalization cannot touch published memory
//     even if (1) regressed. (Its own reason for existing is atomicity: a rule
//     set rejected by NormalizeAndValidate must not partially mutate the live
//     config.)
//
// The property pinned here is the one the billing path actually depends on,
// stated without reference to either mechanism: a Match map handed out before a
// reload is neither mutated by that reload nor aliased to the table it
// publishes. A refactor that removes both layers -- or replaces them with a
// single one that has neither effect -- fails here instead of shipping a silent
// race that surfaces only as a mispriced request under concurrent load.
func TestReloadNeverWritesIntoMatchMapsAlreadyHandedOut(t *testing.T) {
	original := GetVideoPriceRules()
	t.Cleanup(func() {
		videoPriceSettingMu.Lock()
		defer videoPriceSettingMu.Unlock()
		videoPriceSetting.VideoPriceRules = original
	})

	manager := config.NewConfigManager()
	manager.Register("billing_setting_video", &videoPriceSetting)

	// Uncanonical spellings, so normalization has real in-place work to do.
	if err := manager.LoadFromDB(map[string]string{
		"billing_setting_video.video_price_rules": marshalRules(t, []VideoPriceRule{
			{Model: "m", Match: map[string]string{"resolution": "4K"},
				PricePerSecond: 0.314, Basis: BasisOutputDuration},
		}),
	}); err != nil {
		t.Fatalf("first LoadFromDB failed: %v", err)
	}

	// Stand in for a request that has captured its snapshot and is still using
	// it while an administrator saves new rules.
	held := GetVideoPriceRules()
	if len(held) != 1 {
		t.Fatalf("held = %+v, want one rule", held)
	}
	heldMatch := held[0].Match
	if heldMatch["resolution"] != "4k" {
		t.Fatalf("resolution = %q, want the folded %q", heldMatch["resolution"], "4k")
	}

	if err := manager.LoadFromDB(map[string]string{
		"billing_setting_video.video_price_rules": marshalRules(t, []VideoPriceRule{
			{Model: "m", Match: map[string]string{"resolution": "720P"},
				PricePerSecond: 0.140, Basis: BasisOutputDuration},
		}),
	}); err != nil {
		t.Fatalf("second LoadFromDB failed: %v", err)
	}

	if len(heldMatch) != 1 || heldMatch["resolution"] != "4k" {
		t.Fatalf("the reload wrote into a Match map an in-flight request was holding: %v", heldMatch)
	}

	published := GetVideoPriceRules()
	if len(published) != 1 || published[0].Match["resolution"] != "720p" {
		t.Fatalf("published = %+v, want the reloaded 720p rule", published)
	}
	if reflect.ValueOf(heldMatch).Pointer() == reflect.ValueOf(published[0].Match).Pointer() {
		t.Fatal("the reload published the same Match map the previous snapshot handed out: normalization is no longer working on a fresh clone")
	}
}

// The other half of the same property, at the level of the function that
// actually writes. normalizeRuleMatch folds values in place, so its safety is
// entirely a caller obligation: it is sound only because every caller passes
// maps it owns. Pinning the in-place behaviour here documents that obligation
// where it can fail -- if this ever starts copying, the callers' ownership
// requirement has silently changed, and the comment on GetVideoPriceRules
// promising Match is shared-and-read-only no longer describes the code.
func TestNormalizeAndValidateFoldsInPlaceSoCallersMustOwnTheirMaps(t *testing.T) {
	shared := map[string]string{"resolution": "4K"}
	s := &VideoPriceSetting{VideoPriceRules: []VideoPriceRule{
		{Model: "m", Match: shared, PricePerSecond: 0.314, Basis: BasisOutputDuration},
	}}

	if err := s.NormalizeAndValidate(); err != nil {
		t.Fatalf("NormalizeAndValidate failed: %v", err)
	}

	// Visible through the caller's own reference: no defensive copy is made.
	// This is why updateRegisteredConfig must hand it memory nobody else holds.
	if shared["resolution"] != "4k" {
		t.Fatalf("resolution = %q, want %q folded in place", shared["resolution"], "4k")
	}
}

// GetVideoPriceRules is about to move onto the relay hot path, where it runs
// concurrently with an admin-triggered config reload. The reload replaces the
// slice header by reflection inside config.go, so an unlocked getter is a data
// race on every video request. Registers the package-level setting -- the
// memory the getter actually reads -- with a private manager so the race is
// real rather than staged, and restores it afterwards.
func TestGetVideoPriceRulesIsRaceFreeDuringReload(t *testing.T) {
	original := GetVideoPriceRules()
	t.Cleanup(func() {
		videoPriceSettingMu.Lock()
		defer videoPriceSettingMu.Unlock()
		videoPriceSetting.VideoPriceRules = original
	})

	manager := config.NewConfigManager()
	manager.Register("billing_setting_video", &videoPriceSetting)

	first := marshalRules(t, []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.314, Basis: BasisOutputDuration},
	})
	second := marshalRules(t, []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "480p"},
			PricePerSecond: 0.140, Basis: BasisOutputDuration},
		{Model: "m", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.314, Basis: BasisOutputDuration},
	})

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for i := 0; i < 200; i++ {
			payload := first
			if i%2 == 1 {
				payload = second
			}
			if err := manager.LoadFromDB(map[string]string{
				"billing_setting_video.video_price_rules": payload,
			}); err != nil {
				t.Errorf("LoadFromDB failed: %v", err)
				return
			}
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < 200; i++ {
			// Read the header and index it: both must see one consistent
			// snapshot, never a torn header from a half-applied reload.
			rules := GetVideoPriceRules()
			for _, r := range rules {
				if r.PricePerSecond <= 0 {
					t.Errorf("observed a torn rule set: %+v", rules)
					return
				}
			}
		}
	}()
	wg.Wait()
}

func TestNormalizeVideoPriceRules_FoldsMatchValues(t *testing.T) {
	// Administrators type rule values by hand. Adapters emit canonical,
	// already-normalized dimensions, so an un-folded "4K" would never match and
	// every request for that model would be rejected as unpriceable.
	rules := []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "4K", "has_video": "True"},
			PricePerSecond: 1, Basis: BasisOutputDuration},
		{Model: "m", Match: map[string]string{"resolution": "  2160P  "},
			PricePerSecond: 2, Basis: BasisOutputDuration},
	}
	if err := NormalizeVideoPriceRules(rules); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := rules[0].Match["resolution"]; got != "4k" {
		t.Fatalf("resolution = %q, want 4k", got)
	}
	if got := rules[0].Match["has_video"]; got != "true" {
		t.Fatalf("has_video = %q, want true", got)
	}
	if got := rules[1].Match["resolution"]; got != "4k" {
		t.Fatalf("aliased resolution = %q, want 4k", got)
	}
}

func TestNormalizeVideoPriceRules_RejectsUncanonicalValues(t *testing.T) {
	cases := []struct {
		name  string
		match map[string]string
	}{
		{"unknown resolution", map[string]string{"resolution": "1440p"}},
		{"nonsense resolution", map[string]string{"resolution": "banana"}},
		{"non-boolean has_video", map[string]string{"has_video": "yes"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rules := []VideoPriceRule{
				{Model: "m", Match: tc.match, PricePerSecond: 1, Basis: BasisOutputDuration},
			}
			if err := NormalizeVideoPriceRules(rules); err == nil {
				t.Fatalf("expected rejection for %s", tc.name)
			}
		})
	}
}

func TestNormalizeVideoPriceRules_LeavesUnknownDimensionsAlone(t *testing.T) {
	// A dimension no adapter emits yet must survive untouched: it is how a new
	// dimension is rolled out, and FindVideoPriceRule already refuses to match
	// a rule constraining something unresolved.
	rules := []VideoPriceRule{
		{Model: "m", Match: map[string]string{"fps": "30"},
			PricePerSecond: 1, Basis: BasisOutputDuration},
	}
	if err := NormalizeVideoPriceRules(rules); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := rules[0].Match["fps"]; got != "30" {
		t.Fatalf("fps = %q, want 30 untouched", got)
	}
}

func TestNormalizeAndValidate_NormalizesBeforeChecking(t *testing.T) {
	// Normalization can create an ambiguity that was not visible in the raw
	// input: "4K" and "4k" are the same tier once folded. If folding ran after
	// the ambiguity check, this pair would slip through and prices would depend
	// on array order.
	s := &VideoPriceSetting{VideoPriceRules: []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "4K"},
			PricePerSecond: 1, Basis: BasisOutputDuration},
		{Model: "m", Match: map[string]string{"resolution": "4k"},
			PricePerSecond: 2, Basis: BasisOutputDuration},
	}}
	if err := s.NormalizeAndValidate(); err != nil {
		t.Fatalf("the load path must not fail the whole set: %v", err)
	}
	if IsVideoModelConfigured(s.VideoPriceRules, "m") {
		t.Fatalf("folded duplicates must quarantine the model, got %+v", s.VideoPriceRules)
	}
}

func TestNormalizeAndValidate_QuarantinesOnlyTheBadModel(t *testing.T) {
	// A typo in one model's rule must not take every other model's pricing down
	// with it. ConfigManager logs a rejected load and continues, so an
	// all-or-nothing rule set turns one typo into a silent, fleet-wide revert
	// to legacy billing for models that were configured correctly.
	s := &VideoPriceSetting{VideoPriceRules: []VideoPriceRule{
		{Model: "good", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.3, Basis: BasisOutputDuration},
		{Model: "typo", Match: map[string]string{"resolution": "1440p"},
			PricePerSecond: 1, Basis: BasisOutputDuration},
	}}
	if err := s.NormalizeAndValidate(); err != nil {
		t.Fatalf("a typo in one model must not reject the table: %v", err)
	}
	if !IsVideoModelConfigured(s.VideoPriceRules, "good") {
		t.Fatal("the well-formed model lost its pricing as collateral")
	}
	// The bad model must be absent entirely, not half-configured: present-but-
	// unmatchable would hard-fail every request for it.
	if IsVideoModelConfigured(s.VideoPriceRules, "typo") {
		t.Fatal("the malformed model must be dropped, not left unmatchable")
	}
}

func TestNormalizeAndValidate_QuarantinesEveryRuleOfTheBadModel(t *testing.T) {
	// Dropping only the offending row would leave the model configured but
	// missing a tier, so requests for that tier would hard-fail. The whole
	// model has to go.
	s := &VideoPriceSetting{VideoPriceRules: []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.3, Basis: BasisOutputDuration},
		{Model: "m", Match: map[string]string{"resolution": "banana"},
			PricePerSecond: 1, Basis: BasisOutputDuration},
	}}
	if err := s.NormalizeAndValidate(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if IsVideoModelConfigured(s.VideoPriceRules, "m") {
		t.Fatal("a model with any malformed rule must be dropped entirely")
	}
}

func TestNormalizeAndValidate_QuarantinesAmbiguousModel(t *testing.T) {
	s := &VideoPriceSetting{VideoPriceRules: []VideoPriceRule{
		{Model: "good", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.3, Basis: BasisOutputDuration},
		{Model: "ambig", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 1, Basis: BasisOutputDuration},
		{Model: "ambig", Match: map[string]string{"has_video": "true"},
			PricePerSecond: 2, Basis: BasisOutputDuration},
	}}
	if err := s.NormalizeAndValidate(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !IsVideoModelConfigured(s.VideoPriceRules, "good") {
		t.Fatal("the well-formed model lost its pricing as collateral")
	}
	if IsVideoModelConfigured(s.VideoPriceRules, "ambig") {
		t.Fatal("the ambiguous model must be dropped")
	}
}

func TestValidateVideoPriceRules_StillStrictForSaves(t *testing.T) {
	// The save path must stay all-or-nothing: an administrator needs to see the
	// typo, not have it silently quarantined.
	rules := []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0, Basis: BasisOutputDuration},
	}
	if err := ValidateVideoPriceRules(rules); err == nil {
		t.Fatal("ValidateVideoPriceRules must stay strict")
	}
}

func TestNormalizeVideoPriceRules_FoldsModeForKling(t *testing.T) {
	// kling prices by generation mode, not resolution. Without folding, "Std"
	// saves cleanly and then never matches the "std" adapters emit -- which for
	// a configured model rejects every request.
	rules := []VideoPriceRule{
		{Model: "kling", Match: map[string]string{"mode": " Pro "},
			PricePerSecond: 1, Basis: BasisOutputDuration},
	}
	if err := NormalizeVideoPriceRules(rules); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := rules[0].Match["mode"]; got != "pro" {
		t.Fatalf("mode = %q, want pro", got)
	}
}

func TestNormalizeVideoPriceRules_RejectsUnknownMode(t *testing.T) {
	rules := []VideoPriceRule{
		{Model: "kling", Match: map[string]string{"mode": "turbo"},
			PricePerSecond: 1, Basis: BasisOutputDuration},
	}
	if err := NormalizeVideoPriceRules(rules); err == nil {
		t.Fatal("an unrecognized mode must be rejected at save time")
	}
}

// A reload must not mutate a Match map that a request already captured.
// GetVideoPriceRules hands out a shallow copy whose Match maps alias the live
// table, and normalizeRuleMatch writes into Match in place -- so the safety of
// that aliasing rests entirely on WHICH maps get normalized.
//
// This is the same property as
// TestReloadNeverWritesIntoMatchMapsAlreadyHandedOut above, approached from the
// registered-setting side rather than through GetVideoPriceRules. See that
// test's comment for which layer actually carries it: mutation testing shows
// the fresh-slice allocation in updateConfigFromMap is the primary guard, and
// the JSON clone in updateRegisteredConfig is a redundant second one -- removing
// either alone leaves both tests green.
func TestReloadDoesNotMutateCapturedMatchMaps(t *testing.T) {
	manager := config.NewConfigManager()
	setting := &VideoPriceSetting{}
	manager.Register("billing_setting_video", setting)

	published := []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.3, Basis: BasisOutputDuration},
	}
	if err := manager.LoadFromDB(map[string]string{
		"billing_setting_video.video_price_rules": marshalRules(t, published),
	}); err != nil {
		t.Fatalf("LoadFromDB: %v", err)
	}

	// A request captures the live snapshot, exactly as an adaptor does.
	captured := setting.VideoPriceRules
	capturedMatch := captured[0].Match
	if capturedMatch["resolution"] != "720p" {
		t.Fatalf("setup: captured %v", capturedMatch)
	}

	// A reload arrives mid-request, carrying a value that needs folding.
	reloaded := []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "4K"},
			PricePerSecond: 0.9, Basis: BasisOutputDuration},
	}
	if err := manager.LoadFromDB(map[string]string{
		"billing_setting_video.video_price_rules": marshalRules(t, reloaded),
	}); err != nil {
		t.Fatalf("LoadFromDB: %v", err)
	}

	if got := capturedMatch["resolution"]; got != "720p" {
		t.Fatalf("the reload mutated a map an in-flight request had captured: %q", got)
	}
	if got := setting.VideoPriceRules[0].Match["resolution"]; got != "4k" {
		t.Fatalf("reload should have folded 4K to 4k, got %q", got)
	}
}

// The save path and the load path deliberately disagree on bad rules, and each
// choice follows from who is there to hear about it.
//
// A save has an administrator in front of it, so it rejects: handleConfigUpdate
// writes the raw value to OptionMap and the database whenever the update returns
// nil, so quarantining would report success while dropping the model.
//
// A load has nobody, and rejecting the whole set would revert every correctly
// configured model to legacy billing over one typo -- so it quarantines the
// offending model and keeps the rest serving.
func TestSaveRejectsWhatLoadQuarantines(t *testing.T) {
	restore := swapVideoPriceSetting(t)
	defer restore()

	ambiguous := []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 9, Basis: BasisOutputDuration},
		{Model: "m", Match: map[string]string{"has_video": "true"},
			PricePerSecond: 99, Basis: BasisOutputDuration},
		{Model: "keep", Match: map[string]string{"resolution": "480p"},
			PricePerSecond: 0.1, Basis: BasisOutputDuration},
	}

	// Save: refuses outright, live table untouched.
	if err := UpdateVideoPriceSettingFromMap(map[string]string{
		"video_price_rules": marshalRules(t, ambiguous),
	}); err == nil {
		t.Fatal("a save must reject an ambiguous rule set")
	}
	if len(GetVideoPriceRules()) != 0 {
		t.Fatalf("a rejected save must not touch the live table: %+v", GetVideoPriceRules())
	}

	// Load: quarantines the bad model, keeps the good one serving.
	loaded := &VideoPriceSetting{VideoPriceRules: ambiguous}
	if err := loaded.NormalizeAndValidate(); err != nil {
		t.Fatalf("a load must not fail the whole set: %v", err)
	}
	if IsVideoModelConfigured(loaded.VideoPriceRules, "m") {
		t.Fatal("the ambiguous model must be quarantined on load")
	}
	if !IsVideoModelConfigured(loaded.VideoPriceRules, "keep") {
		t.Fatal("the well-formed model must survive the load")
	}
}

// The same path must also fold hand-written values, or a rule saved as "4K"
// never matches the "4k" adapters emit and every request for that model is
// rejected as unpriceable.
func TestUpdateConfigFromMapFoldsMatchValues(t *testing.T) {
	restore := swapVideoPriceSetting(t)
	defer restore()
	if err := UpdateVideoPriceSettingFromMap(map[string]string{
		"video_price_rules": marshalRules(t, []VideoPriceRule{
			{Model: "m", Match: map[string]string{"resolution": "4K"},
				PricePerSecond: 1, Basis: BasisOutputDuration},
		}),
	}); err != nil {
		t.Fatalf("UpdateVideoPriceSettingFromMap: %v", err)
	}
	if got := GetVideoPriceRules()[0].Match["resolution"]; got != "4k" {
		t.Fatalf("resolution = %q, want 4k folded", got)
	}
}

// swapVideoPriceSetting isolates a test that writes the package-level table.
func swapVideoPriceSetting(t *testing.T) func() {
	t.Helper()
	videoPriceSettingMu.Lock()
	prev := videoPriceSetting
	videoPriceSettingMu.Unlock()
	return func() {
		videoPriceSettingMu.Lock()
		videoPriceSetting = prev
		videoPriceSettingMu.Unlock()
	}
}

// An administrator save must fail loudly, not quarantine. handleConfigUpdate
// writes the raw value into OptionMap and the database whenever this returns
// nil (model/option.go:884-886), so a quarantining save would report success
// while the model was silently dropped from the live table -- the admin sees
// their price saved, and the model bills on its old path.
//
// Quarantine belongs to the load path, where the alternative is a fleet-wide
// outage of the table. At the point of entry there is a human to tell.
func TestUpdateVideoPriceSettingFromMapRejectsBadRulesOutright(t *testing.T) {
	restore := swapVideoPriceSetting(t)
	defer restore()

	good := []VideoPriceRule{
		{Model: "keep", Match: map[string]string{"resolution": "480p"},
			PricePerSecond: 0.1, Basis: BasisOutputDuration},
	}
	if err := UpdateVideoPriceSettingFromMap(map[string]string{
		"video_price_rules": marshalRules(t, good),
	}); err != nil {
		t.Fatalf("valid save must succeed: %v", err)
	}

	cases := map[string][]VideoPriceRule{
		"unrecognized value": {
			{Model: "m", Match: map[string]string{"resolution": "1440p"},
				PricePerSecond: 1, Basis: BasisOutputDuration},
		},
		"ambiguous pair": {
			{Model: "m", Match: map[string]string{"resolution": "720p"},
				PricePerSecond: 1, Basis: BasisOutputDuration},
			{Model: "m", Match: map[string]string{"has_video": "true"},
				PricePerSecond: 2, Basis: BasisOutputDuration},
		},
		"zero price": {
			{Model: "m", PricePerSecond: 0, Basis: BasisOutputDuration},
		},
	}
	for name, rules := range cases {
		t.Run(name, func(t *testing.T) {
			err := UpdateVideoPriceSettingFromMap(map[string]string{
				"video_price_rules": marshalRules(t, rules),
			})
			if err == nil {
				t.Fatal("a bad save must be rejected, not silently quarantined")
			}
			// The previously saved table must still be serving.
			if !IsVideoModelConfigured(GetVideoPriceRules(), "keep") {
				t.Fatal("a rejected save discarded the table that was already live")
			}
		})
	}
}

// The console dropdown offers a hardcoded copy of this vocabulary, because the
// browser cannot import Go. That copy is the third: taskcommon already carries
// one, duplicated because the import direction forbids sharing, and those two
// drifted until a test pinned them.
//
// This pins the TypeScript. If a resolution is added here without adding it to
// the console, the dropdown silently omits a tier an administrator can no
// longer configure -- and its own test would keep passing, because it asserts
// against its own literal.
func TestCanonicalResolutionsMatchConsoleVocabulary(t *testing.T) {
	// web/default/src/features/system-settings/models/video-pricing-types.ts
	// RESOLUTION_VALUES. Keep both sides in step.
	console := []string{"480p", "512p", "720p", "768p", "1080p", "2k", "4k"}

	backend := CanonicalResolutionValues()
	if len(backend) != len(console) {
		t.Fatalf("backend offers %d resolutions %v, console offers %d %v",
			len(backend), backend, len(console), console)
	}
	inConsole := make(map[string]bool, len(console))
	for _, v := range console {
		inConsole[v] = true
	}
	for _, v := range backend {
		if !inConsole[v] {
			t.Fatalf("backend resolution %q is missing from the console dropdown "+
				"(RESOLUTION_VALUES in video-pricing-types.ts): an administrator "+
				"cannot configure that tier", v)
		}
	}
}

func TestGrokSubscriptionDefaultVideoPriceRulesMergeWithoutGlobalMutation(t *testing.T) {
	admin := []VideoPriceRule{
		{Model: "grok-imagine-video", Match: map[string]string{"action": "extend", "has_video": "true"},
			PricePerSecond: 9, Basis: BasisOutputDuration},
		{Model: "custom", Match: map[string]string{"resolution": "480p"},
			PricePerSecond: 1, Basis: BasisOutputDuration},
	}
	merged := GetGrokSubscriptionVideoPriceRules(admin)

	if !IsVideoModelConfigured(merged, "grok-imagine-video") {
		t.Fatal("administrator override model must stay configured")
	}
	if !IsVideoModelConfigured(merged, "grok-imagine-video-1.5") {
		t.Fatal("missing Grok Subscription model must receive defaults")
	}
	if !IsVideoModelConfigured(merged, "custom") {
		t.Fatal("unrelated administrator model was dropped")
	}

	countLegacy := 0
	for _, r := range merged {
		if r.Model == "grok-imagine-video" {
			countLegacy++
			if r.PricePerSecond != 9 {
				t.Fatalf("administrator rules must replace defaults as a coherent model set, got %+v", r)
			}
		}
	}
	if countLegacy != 1 {
		t.Fatalf("legacy model rule count = %d, want only the admin override", countLegacy)
	}

	global := GetVideoPriceRules()
	if IsVideoModelConfigured(global, "grok-imagine-video") || IsVideoModelConfigured(global, "grok-imagine-video-1.5") {
		t.Fatal("Grok Subscription defaults must not be published into the global administrator table")
	}
}

func TestValidateVideoPriceRulesRejectsGrokEditOutputDuration(t *testing.T) {
	rules := []VideoPriceRule{
		{Model: "grok-imagine-video", Match: map[string]string{"action": "edit", "has_video": "true"},
			PricePerSecond: 0.09, Basis: BasisOutputDuration},
	}
	if err := ValidateVideoPriceRules(rules); err == nil {
		t.Fatal("Grok edit rules must not use output_duration")
	}
}

func TestValidateVideoPriceRulesAcceptsGrokEditTotalDuration(t *testing.T) {
	rules := []VideoPriceRule{
		{Model: "grok-imagine-video-1.5", Match: map[string]string{"action": "edit", "has_video": "true"},
			PricePerSecond: 0.11, Basis: BasisTotalDuration, FallbackSeconds: 8.7},
	}
	if err := ValidateVideoPriceRules(rules); err != nil {
		t.Fatalf("Grok edit total_duration rule must stay valid: %v", err)
	}
}

func TestGrokSubscriptionDefaultVideoPriceRulesCoverDocumentedActionsAndResolutions(t *testing.T) {
	rules := GetGrokSubscriptionVideoPriceRules(nil)
	if err := ValidateVideoPriceRules(rules); err != nil {
		t.Fatalf("default rules must validate: %v", err)
	}

	required := []struct {
		model string
		match map[string]string
	}{
		{"grok-imagine-video", map[string]string{"action": "generate", "resolution": "480p", "has_video": "false"}},
		{"grok-imagine-video", map[string]string{"action": "generate", "resolution": "720p", "has_video": "false"}},
		{"grok-imagine-video", map[string]string{"action": "edit", "has_video": "true"}},
		{"grok-imagine-video", map[string]string{"action": "extend", "has_video": "true"}},
		{"grok-imagine-video-1.5", map[string]string{"action": "generate", "resolution": "480p", "has_video": "false"}},
		{"grok-imagine-video-1.5", map[string]string{"action": "generate", "resolution": "720p", "has_video": "false"}},
		{"grok-imagine-video-1.5", map[string]string{"action": "generate", "resolution": "1080p", "has_video": "false"}},
		{"grok-imagine-video-1.5", map[string]string{"action": "edit", "has_video": "true"}},
		{"grok-imagine-video-1.5", map[string]string{"action": "extend", "has_video": "true"}},
	}
	for _, req := range required {
		if _, ok := FindVideoPriceRule(rules, req.model, req.match); !ok {
			t.Fatalf("missing default rule for model=%s match=%v", req.model, req.match)
		}
	}
}
