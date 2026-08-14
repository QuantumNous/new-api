package autopricing

import (
	"fmt"
	"math"
)

// ratioUnitUSDPerMillionTokens is the USD price that one Ren2Hub ratio unit
// represents per 1M tokens: 1 unit = $0.002 / 1K tokens = $2 / 1M tokens.
//
// setting/ratio_setting expresses the same unit as USD = 500 ($1 = 500 units),
// but that package imports this one, so the constant cannot be shared in that
// direction. TestRatioUnitMatchesRatioSetting in setting/ratio_setting pins the
// two definitions together.
const ratioUnitUSDPerMillionTokens = 2.0

// Upstream data is untrusted input that feeds quota arithmetic. Anything beyond
// these bounds is corruption rather than a real price, and is dropped instead of
// being clamped, so a bad catalog entry falls back to "not configured" rather
// than to a plausible-looking wrong charge.
const (
	maxModelRatio = 1e6
	maxMultiplier = 1e4
)

// BuildCatalog is the compatibility entry point for a single LiteLLM-shaped
// document. It deliberately uses the same PriceRecord parser and merge path as
// the multi-source service so tests and legacy callers cannot create a second,
// less capable pricing fact.
func BuildCatalog(data []byte, version string) (*Catalog, error) {
	source, err := ParseMirrorSource(data, version)
	if err != nil {
		return nil, fmt.Errorf("parse pricing catalog: %w", err)
	}
	catalog, err := MergeSources(source)
	if err != nil {
		return nil, fmt.Errorf("build pricing catalog: %w", err)
	}
	return catalog, nil
}

func validCost(v float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0) && v >= 0
}

// roundRatio matches the precision used by the manual upstream ratio sync in
// controller/ratio_sync.go so both sources produce comparable numbers.
func roundRatio(value float64) float64 {
	return math.Round(value*1e6) / 1e6
}
