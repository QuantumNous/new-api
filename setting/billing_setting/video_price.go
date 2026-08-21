package billing_setting

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// Basis selects which duration the per-second price multiplies.
const (
	// BasisOutputDuration bills the generated video length only.
	BasisOutputDuration = "output_duration"
	// BasisTotalDuration bills input media plus generated length, matching
	// upstream pricing for requests that carry a reference video.
	BasisTotalDuration = "total_duration"
)

// VideoPriceRule is one row of the administrator-configured price table.
//
// Match holds open-ended billing dimensions. A rule is a candidate when every
// key in Match equals the dimension the adapter resolved; absent keys are
// wildcards. Adding a new dimension therefore never invalidates existing rules.
type VideoPriceRule struct {
	Model          string            `json:"model"`
	Match          map[string]string `json:"match"`
	PricePerSecond float64           `json:"price_per_second"`
	Basis          string            `json:"basis"`
	// FallbackSeconds is the reservation length used when input media duration
	// cannot be determined. Required when Basis is BasisTotalDuration.
	FallbackSeconds float64 `json:"fallback_seconds"`

	// Documentation only; these never affect billing. They record how a rate
	// was derived so an upstream fps or token-rate change can be traced back to
	// the entries that need recomputing.
	SourceRatePer1MTokens float64 `json:"source_rate_per_1m_tokens,omitempty"`
	AssumedFPS            float64 `json:"assumed_fps,omitempty"`
}

// VideoPriceSetting is managed by config.GlobalConfig.Register.
// DB key: billing_setting_video.video_price_rules
type VideoPriceSetting struct {
	VideoPriceRules []VideoPriceRule `json:"video_price_rules"`
}

var videoPriceSetting = VideoPriceSetting{
	VideoPriceRules: make([]VideoPriceRule, 0),
}

// videoPriceSettingMu guards videoPriceSetting. ConfigManager replaces the
// struct by reflection during a reload, so the lock has to be reachable from
// there: the locker methods below hand it to the manager.
var videoPriceSettingMu sync.RWMutex

// LockConfig/UnlockConfig/RLockConfig/RUnlockConfig make this setting a
// configWriteLocker and configReadLocker, so ConfigManager holds this package's
// lock across its reflective swap. Nothing in this package could take that lock
// itself -- the write happens inside setting/config -- so without these methods
// a reload would race every reader on the relay hot path.
func (s *VideoPriceSetting) LockConfig() {
	videoPriceSettingMu.Lock()
}

func (s *VideoPriceSetting) UnlockConfig() {
	videoPriceSettingMu.Unlock()
}

func (s *VideoPriceSetting) RLockConfig() {
	videoPriceSettingMu.RLock()
}

func (s *VideoPriceSetting) RUnlockConfig() {
	videoPriceSettingMu.RUnlock()
}

func init() {
	config.GlobalConfig.Register("billing_setting_video", &videoPriceSetting)
}

func isPositiveFinite(v float64) bool {
	return v > 0 && !math.IsNaN(v) && !math.IsInf(v, 0)
}

// canBothMatch reports whether two rules could ever match the same request.
// Rules that constrain a shared key to different values are mutually
// exclusive, so they are not ambiguous however many constraints they carry.
func canBothMatch(a, b map[string]string) bool {
	for k, av := range a {
		if bv, ok := b[k]; ok && av != bv {
			return false
		}
	}
	return true
}

// ValidateVideoPriceRules rejects a rule set that could price a request wrongly
// or ambiguously. Callers must keep the previous configuration on error.
func ValidateVideoPriceRules(rules []VideoPriceRule) error {
	for i, r := range rules {
		if r.Model == "" {
			return fmt.Errorf("video price rule %d: model is required", i)
		}
		if !isPositiveFinite(r.PricePerSecond) {
			return fmt.Errorf(
				"video price rule %d (model %s): price_per_second must be positive and finite",
				i, r.Model)
		}
		switch r.Basis {
		case BasisOutputDuration:
		case BasisTotalDuration:
			if !isPositiveFinite(r.FallbackSeconds) {
				return fmt.Errorf(
					"video price rule %d (model %s): basis %s requires a positive fallback_seconds",
					i, r.Model, BasisTotalDuration)
			}
		default:
			return fmt.Errorf(
				"video price rule %d (model %s): basis must be %s or %s, got %q",
				i, r.Model, BasisOutputDuration, BasisTotalDuration, r.Basis)
		}
		if strings.HasPrefix(r.Model, "grok-imagine-video") && r.Match["action"] == "edit" && r.Basis == BasisOutputDuration {
			return fmt.Errorf(
				"video price rule %d (model %s): action edit must use %s, got %s",
				i, r.Model, BasisTotalDuration, BasisOutputDuration)
		}
	}
	// Two rules for one model are ambiguous only when they have equal constraint
	// counts AND could both match the same request: there is then no principled
	// winner, so reject rather than pick arbitrarily. Differing counts are
	// resolved by most-constrained-wins, and constraints that disagree on a
	// shared key can never both match.
	for i := range rules {
		for j := i + 1; j < len(rules); j++ {
			if rules[i].Model != rules[j].Model {
				continue
			}
			if len(rules[i].Match) != len(rules[j].Match) {
				continue
			}
			if canBothMatch(rules[i].Match, rules[j].Match) {
				return fmt.Errorf(
					"video price rules %d and %d (model %s): ambiguous, both have %d constraints and can match the same request",
					i, j, rules[i].Model, len(rules[i].Match))
			}
		}
	}
	return nil
}

// Canonical values a rule's Match may constrain. Adapters normalize what the
// upstream sends before matching, so a rule has to be expressed in the same
// vocabulary or it can never match.
//
// This duplicates taskcommon.NormalizeResolution's vocabulary rather than
// calling it: taskcommon imports this package, so the dependency cannot run the
// other way. The two must be kept in step; TestNormalizeVideoPriceRules guards
// this side.
var (
	canonicalResolutions = map[string]string{
		"480p": "480p",
		// hailuo (v1) owns its own label map and emits this; the MiniMax
		// I2V/T2V model configs really serve a 512P tier, and without this
		// value an administrator cannot save a rule for it.
		"512p": "512p",
		"720p": "720p",
		// hailuo_v2 owns its own label map and emits these two; without them an
		// administrator cannot save a rule for a tier that channel really uses.
		"768p":  "768p",
		"1080p": "1080p",
		"2k":    "2k",
		"4k":    "4k",
		"2160p": "4k",
	}
	canonicalHasVideo = map[string]string{
		"true":  "true",
		"false": "false",
	}
	// kling prices by generation mode rather than by output resolution, so a
	// rule for that channel constrains "mode" instead. Folding it here stops a
	// plausible typo ("Std") from saving cleanly and then rejecting every
	// request for the model.
	canonicalMode = map[string]string{
		"std": "std",
		"pro": "pro",
	}
	// Only dimensions with a closed vocabulary are normalized. Anything else is
	// left untouched so a new dimension can be configured before every adapter
	// emits it -- FindVideoPriceRule already refuses to match a rule that
	// constrains a dimension nobody resolved.
	canonicalDimensions = map[string]map[string]string{
		"resolution": canonicalResolutions,
		"has_video":  canonicalHasVideo,
		"mode":       canonicalMode,
	}
)

// CanonicalResolutionValues lists every canonical resolution a rule may be
// saved with. Exported so adapters can test that each one is actually reachable
// -- a value nobody emits makes a rule unmatchable, which for a configured
// model rejects every request.
func CanonicalResolutionValues() []string {
	seen := make(map[string]bool, len(canonicalResolutions))
	values := make([]string, 0, len(canonicalResolutions))
	for _, canonical := range canonicalResolutions {
		if seen[canonical] {
			continue
		}
		seen[canonical] = true
		values = append(values, canonical)
	}
	sort.Strings(values)
	return values
}

// quarantineBadModels drops every rule belonging to a model that has any
// malformed or ambiguous rule, and reports what it dropped.
//
// The whole model goes, not just the offending row: a model left with some of
// its tiers missing is still "configured", so a request for a dropped tier
// would hard-fail rather than fall back to legacy billing. Dropping the model
// entirely returns it cleanly to its previous behaviour.
func quarantineBadModels(rules []VideoPriceRule) ([]VideoPriceRule, []string) {
	bad := make(map[string]string)
	for i, r := range rules {
		if r.Model == "" {
			continue
		}
		if _, already := bad[r.Model]; already {
			continue
		}
		// Normalization runs here rather than in a separate pass so that a value
		// which will not fold quarantines its model instead of silently staying
		// unmatchable, which for a configured model rejects every request.
		if err := normalizeRuleMatch(r); err != nil {
			bad[r.Model] = err.Error()
			continue
		}
		if err := ValidateVideoPriceRules(rules[i : i+1]); err != nil {
			bad[r.Model] = err.Error()
		}
	}
	// Ambiguity is a property of a pair, so it needs a second pass over the
	// rules that survived the per-rule check.
	for i := range rules {
		for j := i + 1; j < len(rules); j++ {
			if rules[i].Model != rules[j].Model || rules[i].Model == "" {
				continue
			}
			if _, already := bad[rules[i].Model]; already {
				continue
			}
			if len(rules[i].Match) == len(rules[j].Match) && canBothMatch(rules[i].Match, rules[j].Match) {
				bad[rules[i].Model] = fmt.Sprintf(
					"rules %d and %d are ambiguous: both have %d constraints and can match the same request",
					i, j, len(rules[i].Match))
			}
		}
	}

	if len(bad) == 0 {
		return rules, nil
	}
	kept := make([]VideoPriceRule, 0, len(rules))
	for _, r := range rules {
		if _, dropped := bad[r.Model]; !dropped || r.Model == "" {
			kept = append(kept, r)
		}
	}
	reasons := make([]string, 0, len(bad))
	for model, reason := range bad {
		reasons = append(reasons, fmt.Sprintf("%s (%s)", model, reason))
	}
	sort.Strings(reasons)
	return kept, reasons
}

// normalizeRuleMatch folds one rule's Match values in place, reporting the
// first unrecognized value instead of aborting the whole set.
func normalizeRuleMatch(r VideoPriceRule) error {
	for key, raw := range r.Match {
		vocabulary, closed := canonicalDimensions[key]
		if !closed {
			continue
		}
		canonical, ok := vocabulary[strings.ToLower(strings.TrimSpace(raw))]
		if !ok {
			return fmt.Errorf("%s=%q is not a recognized value", key, raw)
		}
		r.Match[key] = canonical
	}
	return nil
}

// NormalizeVideoPriceRules folds hand-written Match values to the canonical
// forms adapters emit, and rejects values outside a known vocabulary.
//
// Administrators write these by hand, so "4K", "2160p" and " 720P " are all
// plausible input for a value an adapter will always report as "4k" or "720p".
// Silently keeping the raw spelling would make the rule unmatchable, and for a
// configured model an unmatchable rule means every request is rejected as
// unpriceable. Rejecting an unrecognized value here surfaces the typo when it
// is saved rather than when traffic arrives.
//
// This is the strict, all-or-nothing form used when an administrator saves.
// The load path quarantines per model instead — see NormalizeAndValidate.
//
// Rules are modified in place.
func NormalizeVideoPriceRules(rules []VideoPriceRule) error {
	for i, r := range rules {
		if err := normalizeRuleMatch(r); err != nil {
			return fmt.Errorf("video price rule %d (model %s): %w", i, r.Model, err)
		}
	}
	return nil
}

// NormalizeAndValidate makes this setting a normalizing config, so ConfigManager
// runs it on a candidate rule set before swapping it in. Without it, rules
// stored in the database would reach memory unvalidated and FindVideoPriceRule's
// most-constrained-wins tie-break — which assumes ties are impossible — would
// silently decide prices by JSON array order.
//
// This path quarantines per model rather than rejecting the whole set. An
// all-or-nothing load turns one typo into a fleet-wide outage of the price
// table: ConfigManager logs a rejected load and carries on with the previous
// rules, so every correctly-configured model would silently revert to legacy
// billing with nothing but a log line to say why. Dropping only the offending
// model keeps the rest of the table serving and returns that one model cleanly
// to its previous behaviour.
//
// Saves stay strict — see NormalizeVideoPriceRules — so an administrator sees
// the typo at the point of entry instead of discovering it in a log.
func (s *VideoPriceSetting) NormalizeAndValidate() error {
	kept, dropped := quarantineBadModels(s.VideoPriceRules)
	if len(dropped) > 0 {
		common.SysError("video price rules ignored for " + strings.Join(dropped, "; "))
	}
	s.VideoPriceRules = kept
	return nil
}

// FindVideoPriceRule returns the best rule for a model and its resolved
// dimensions. A rule is a candidate when every key in its Match equals the
// corresponding resolved dimension; the candidate with the most constraints
// wins. ValidateVideoPriceRules guarantees no tie is possible.
func FindVideoPriceRule(rules []VideoPriceRule, model string, dims map[string]string) (VideoPriceRule, bool) {
	best := VideoPriceRule{}
	found := false
	for _, r := range rules {
		if r.Model != model {
			continue
		}
		matched := true
		for k, want := range r.Match {
			// A dimension the adapter did not resolve cannot satisfy a
			// constraint, so the rule is not a candidate. Configuring a
			// dimension the code cannot yet produce must degrade to "no
			// match" rather than silently fall through to a cheaper rule.
			if got, ok := dims[k]; !ok || got != want {
				matched = false
				break
			}
		}
		if !matched {
			continue
		}
		if !found || len(r.Match) > len(best.Match) {
			best = r
			found = true
		}
	}
	return best, found
}

// IsVideoModelConfigured reports whether a model appears in the price table at
// all. Presence selects strict per-second billing for that model; absence keeps
// the channel's previous billing path.
func IsVideoModelConfigured(rules []VideoPriceRule, model string) bool {
	for _, r := range rules {
		if r.Model == model {
			return true
		}
	}
	return false
}

// GetVideoPriceRules returns a snapshot of the live rule set.
//
// The returned slice is a copy. Taking the read lock alone would already give a
// consistent view, because a reload swaps the slice header wholesale and never
// edits elements in place -- but the copy also stops a caller that mutates what
// it received from corrupting the table every other request reads, which on a
// billing path is worth the per-call allocation. The copy is shallow: each
// rule's Match map is shared with the live table, so callers must treat Match
// as read-only.
func GetVideoPriceRules() []VideoPriceRule {
	videoPriceSettingMu.RLock()
	defer videoPriceSettingMu.RUnlock()
	return append([]VideoPriceRule(nil), videoPriceSetting.VideoPriceRules...)
}

var grokSubscriptionDefaultVideoPriceRules = []VideoPriceRule{
	{Model: "grok-imagine-video", Match: map[string]string{"action": "generate", "resolution": "480p", "has_video": "false"}, PricePerSecond: 0.09, Basis: BasisOutputDuration},
	{Model: "grok-imagine-video", Match: map[string]string{"action": "generate", "resolution": "720p", "has_video": "false"}, PricePerSecond: 0.09, Basis: BasisOutputDuration},
	{Model: "grok-imagine-video", Match: map[string]string{"action": "edit", "has_video": "true"}, PricePerSecond: 0.09, Basis: BasisTotalDuration, FallbackSeconds: 8.7},
	{Model: "grok-imagine-video", Match: map[string]string{"action": "extend", "has_video": "true"}, PricePerSecond: 0.09, Basis: BasisOutputDuration},
	{Model: "grok-imagine-video-1.5", Match: map[string]string{"action": "generate", "resolution": "480p", "has_video": "false"}, PricePerSecond: 0.11, Basis: BasisOutputDuration},
	{Model: "grok-imagine-video-1.5", Match: map[string]string{"action": "generate", "resolution": "720p", "has_video": "false"}, PricePerSecond: 0.11, Basis: BasisOutputDuration},
	{Model: "grok-imagine-video-1.5", Match: map[string]string{"action": "generate", "resolution": "1080p", "has_video": "false"}, PricePerSecond: 0.11, Basis: BasisOutputDuration},
	{Model: "grok-imagine-video-1.5", Match: map[string]string{"action": "edit", "has_video": "true"}, PricePerSecond: 0.11, Basis: BasisTotalDuration, FallbackSeconds: 8.7},
	{Model: "grok-imagine-video-1.5", Match: map[string]string{"action": "extend", "has_video": "true"}, PricePerSecond: 0.11, Basis: BasisOutputDuration},
}

// GetGrokSubscriptionVideoPriceRules returns the administrator table plus
// Grok Subscription defaults for only the Grok models missing from that table.
// If an administrator defines any rule for a Grok model, that model's whole
// default set is replaced by the administrator's coherent rule set.
func GetGrokSubscriptionVideoPriceRules(adminRules []VideoPriceRule) []VideoPriceRule {
	rules := append([]VideoPriceRule(nil), adminRules...)
	configured := map[string]bool{}
	for _, r := range adminRules {
		if r.Model != "" {
			configured[r.Model] = true
		}
	}
	for _, r := range grokSubscriptionDefaultVideoPriceRules {
		if configured[r.Model] {
			continue
		}
		rules = append(rules, cloneVideoPriceRule(r))
	}
	return rules
}

func cloneVideoPriceRule(r VideoPriceRule) VideoPriceRule {
	if r.Match != nil {
		match := make(map[string]string, len(r.Match))
		for k, v := range r.Match {
			match[k] = v
		}
		r.Match = match
	}
	return r
}

// UpdateVideoPriceSettingFromMap applies an administrator save to the live rule
// table, holding the module write lock and rejecting anything malformed.
//
// The generic path cannot do this. An administrator save reaches
// model/option.go's handleConfigUpdate, which calls config.UpdateConfigFromMap
// -- a raw setter that skips both validation and the module lock. Without this
// entry point an ambiguous rule set reaches the matcher, and FindVideoPriceRule's
// tie-break then decides prices by JSON array order; a hand-written "4K" also
// stays unfolded and never matches the "4k" adapters emit.
//
// This validates strictly rather than quarantining. handleConfigUpdate writes
// the raw value into OptionMap and the database whenever this returns nil, so
// quarantining here would report a successful save while silently dropping the
// model from the live table -- the administrator would see their price stored
// and the model would keep billing on its old path. Quarantine belongs to the
// load path, where the alternative is a fleet-wide outage of the table and
// there is nobody to tell; at the point of entry there is a human to tell.
//
// Mirrors system_setting.UpdateRegistrationSecuritySettingsFromMap.
func UpdateVideoPriceSettingFromMap(values map[string]string) error {
	videoPriceSettingMu.Lock()
	defer videoPriceSettingMu.Unlock()

	next := VideoPriceSetting{
		VideoPriceRules: append([]VideoPriceRule(nil), videoPriceSetting.VideoPriceRules...),
	}
	if err := config.UpdateConfigFromMap(&next, values); err != nil {
		return err
	}
	if err := NormalizeVideoPriceRules(next.VideoPriceRules); err != nil {
		return err
	}
	if err := ValidateVideoPriceRules(next.VideoPriceRules); err != nil {
		return err
	}
	videoPriceSetting = next
	return nil
}
