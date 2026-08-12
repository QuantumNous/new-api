package billing_setting

import (
	"fmt"
	"math"

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

// NormalizeAndValidate makes this setting a normalizing config, so ConfigManager
// validates a candidate rule set before swapping it in and keeps the rules
// already serving traffic when the candidate is rejected. Without it, rules
// stored in the database would reach memory unvalidated and FindVideoPriceRule's
// most-constrained-wins tie-break — which assumes ties are impossible — would
// silently decide prices by JSON array order.
func (s *VideoPriceSetting) NormalizeAndValidate() error {
	return ValidateVideoPriceRules(s.VideoPriceRules)
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

// GetVideoPriceRules returns the live rule set.
func GetVideoPriceRules() []VideoPriceRule {
	return videoPriceSetting.VideoPriceRules
}
