package ratio_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/pkg/autopricing"
)

// hasManualPricing reports whether an administrator has priced this model, by
// either a ratio or a fixed per-call price. The automatic catalog is a fallback
// only, so a manually priced model never consults it.
//
// The caller must pass a name already normalized by FormatMatchingModelName.
func hasManualPricing(name string) bool {
	if _, ok := modelRatioMap.Get(name); ok {
		return true
	}
	if _, ok := modelPriceMap.Get(name); ok {
		return true
	}
	if strings.HasSuffix(name, CompactModelSuffix) {
		if _, ok := modelRatioMap.Get(CompactWildcardModelKey); ok {
			return true
		}
		if _, ok := modelPriceMap.Get(CompactWildcardModelKey); ok {
			return true
		}
	}
	return false
}

// HasManualModelRatio reports whether the manual ratio map itself prices this
// model, applying the same name normalization and compact-wildcard rule as
// GetModelRatio but never consulting the automatic catalog.
//
// Callers use it to answer "did the operator deliberately configure this exact
// billing name", e.g. before rewriting a request to a "-nothinking" variant
// name. The automatic catalog must not trigger such rewrites: it would move a
// manually priced base model onto catalog pricing through the variant's name.
func HasManualModelRatio(name string) bool {
	name = FormatMatchingModelName(name)
	if _, ok := modelRatioMap.Get(name); ok {
		return true
	}
	if strings.HasSuffix(name, CompactModelSuffix) {
		if _, ok := modelRatioMap.Get(CompactWildcardModelKey); ok {
			return true
		}
	}
	return false
}

// autoPricingEntry resolves a model against the automatic catalog. It reports
// false whenever the feature is off, the model is manually priced, or the
// catalog has nothing for it.
//
// Every multiplier a caller takes from the returned entry must come from this
// same entry: mixing an automatic base ratio with a manual completion ratio
// (or the reverse) would bill at a rate that exists in neither source.
func autoPricingEntry(name string) (autopricing.Entry, bool) {
	setting := GetAutoPricingSetting()
	if !setting.Enabled {
		return autopricing.Entry{}, false
	}
	if hasManualPricing(name) {
		return autopricing.Entry{}, false
	}
	return autopricing.Resolve(name, setting.FuzzyMatchEnabled)
}
