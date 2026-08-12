package billing_setting

import (
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

func TestVideoPriceSettingNormalizeAndValidate_RejectsInvalidRules(t *testing.T) {
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
			if err := s.NormalizeAndValidate(); err == nil {
				t.Fatalf("expected rejection for %s", tc.name)
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

// The property that matters: a rule set the administrator saved into the
// database that would make matching order-dependent must be refused, and the
// rules already serving traffic must keep serving it. Driven through a private
// ConfigManager so the real clone-then-swap path runs without touching the
// process-wide config.
func TestVideoPriceSettingLoadFromDBRejectionKeepsPreviousRules(t *testing.T) {
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
	ambiguous := []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 9, Basis: BasisOutputDuration},
		{Model: "m", Match: map[string]string{"has_video": "true"},
			PricePerSecond: 99, Basis: BasisOutputDuration},
	}
	if err := manager.LoadFromDB(map[string]string{
		"billing_setting_video.video_price_rules": marshalRules(t, ambiguous),
	}); err != nil {
		t.Fatalf("LoadFromDB failed: %v", err)
	}
	if len(setting.VideoPriceRules) != 1 || setting.VideoPriceRules[0].PricePerSecond != 0.314 {
		t.Fatalf("rules = %+v, want the previous valid set preserved", setting.VideoPriceRules)
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

func TestNormalizeAndValidate_NormalizesBeforeValidating(t *testing.T) {
	// Normalization can create an ambiguity that was not visible in the raw
	// input: "4K" and "4k" are the same tier once folded.
	s := &VideoPriceSetting{VideoPriceRules: []VideoPriceRule{
		{Model: "m", Match: map[string]string{"resolution": "4K"},
			PricePerSecond: 1, Basis: BasisOutputDuration},
		{Model: "m", Match: map[string]string{"resolution": "4k"},
			PricePerSecond: 2, Basis: BasisOutputDuration},
	}}
	if err := s.NormalizeAndValidate(); err == nil {
		t.Fatal("folded duplicates must be rejected as ambiguous")
	}
}
