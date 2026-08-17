package ratio_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/pkg/autopricing"
)

// hasManualFixedPrice reports whether an administrator has configured fixed
// per-call pricing for this model. Fixed pricing and token pricing are mutually
// exclusive, so it is the only manual field that suppresses the whole automatic
// catalog entry.
//
// The caller must pass a name already normalized by FormatMatchingModelName.
func hasManualFixedPrice(name string) bool {
	if _, ok := modelPriceMap.Get(name); ok {
		return true
	}
	if strings.HasSuffix(name, CompactModelSuffix) {
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

// autoPricingEntry resolves a model against the automatic catalog. Manual
// token-pricing fields override only their matching automatic fields; a fixed
// per-call price suppresses automatic token pricing entirely.
func autoPricingEntry(name string) (autopricing.Entry, bool) {
	setting := GetAutoPricingSetting()
	if !setting.Enabled {
		return autopricing.Entry{}, false
	}
	if hasManualFixedPrice(name) {
		return autopricing.Entry{}, false
	}
	return autopricing.Resolve(name, setting.FuzzyMatchEnabled)
}

func HasAutoPricingEntry(name string) bool {
	name = FormatMatchingModelName(name)
	_, ok := autoPricingEntry(name)
	return ok
}

func HasExactAutoPricingEntry(name string) bool {
	name = FormatMatchingModelName(name)
	setting := GetAutoPricingSetting()
	if !setting.Enabled || hasManualFixedPrice(name) {
		return false
	}
	_, ok := autopricing.Resolve(name, false)
	return ok
}
