package ratio_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

// DefaultAutoPricingRemoteURL points at the maintained LiteLLM mirror.
const DefaultAutoPricingRemoteURL = "https://raw.githubusercontent.com/Wei-Shaw/model-price-repo/main/model_prices_and_context_window.json"
const DefaultAutoPricingHashURL = "https://raw.githubusercontent.com/Wei-Shaw/model-price-repo/main/model_prices_and_context_window.sha256"
const DefaultModelsDevURL = "https://models.dev/api.json"
const LegacyAutoPricingRemoteURL = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"

const (
	// minAutoPricingCheckIntervalMinutes keeps a misconfigured interval from
	// hammering the upstream host.
	minAutoPricingCheckIntervalMinutes = 5
	defaultAutoPricingCheckIntervalMin = 60
)

// AutoPricingSetting controls the automatic upstream pricing catalog used as a
// fallback for models that have no manual ratio and no manual fixed price.
type AutoPricingSetting struct {
	// Enabled turns the fallback catalog on. Manual pricing always takes
	// precedence regardless of this flag.
	Enabled bool `json:"enabled"`
	// RemoteURL is the pricing document to download.
	RemoteURL string `json:"remote_url"`
	// HashURL optionally points at a checksum file published next to the
	// document. Mirrors that do not serve usable ETags can use it as the change
	// token instead.
	HashURL      string `json:"hash_url"`
	ModelsDevURL string `json:"models_dev_url"`
	// CheckIntervalMinutes is how often the catalog is checked for changes.
	CheckIntervalMinutes int `json:"check_interval_minutes"`
	// FuzzyMatchEnabled allows a request model to be priced by an inferred
	// catalog entry (date variants, model families) instead of an exact key.
	FuzzyMatchEnabled bool `json:"fuzzy_match_enabled"`
}

var autoPricingSetting = AutoPricingSetting{
	Enabled:              true,
	RemoteURL:            DefaultAutoPricingRemoteURL,
	HashURL:              DefaultAutoPricingHashURL,
	ModelsDevURL:         DefaultModelsDevURL,
	CheckIntervalMinutes: defaultAutoPricingCheckIntervalMin,
	FuzzyMatchEnabled:    true,
}

func init() {
	config.GlobalConfig.Register("auto_pricing", &autoPricingSetting)
}

// GetAutoPricingSetting returns a snapshot of the current setting. The options
// sync rewrites the registered struct in place through reflection, so callers
// take a copy rather than holding a pointer across a sync cycle.
func GetAutoPricingSetting() AutoPricingSetting {
	return autoPricingSetting
}

// AutoPricingRemoteURL returns the configured document URL, falling back to the
// default when an operator has blanked it out.
func (s AutoPricingSetting) AutoPricingRemoteURL() string {
	url := strings.TrimSpace(s.RemoteURL)
	if url == "" || url == LegacyAutoPricingRemoteURL {
		return DefaultAutoPricingRemoteURL
	}
	return url
}

func (s AutoPricingSetting) ModelsDevRemoteURL() string {
	url := strings.TrimSpace(s.ModelsDevURL)
	if url == "" {
		return DefaultModelsDevURL
	}
	return url
}

func (s AutoPricingSetting) EffectiveHashURL() string {
	return strings.TrimSpace(s.HashURL)
}

// EffectiveCheckIntervalMinutes clamps the configured interval to a sane floor.
func (s AutoPricingSetting) EffectiveCheckIntervalMinutes() int {
	if s.CheckIntervalMinutes < minAutoPricingCheckIntervalMinutes {
		return defaultAutoPricingCheckIntervalMin
	}
	return s.CheckIntervalMinutes
}
