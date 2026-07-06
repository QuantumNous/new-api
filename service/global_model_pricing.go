package service

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// PlatformUSDPerModelRatio converts new-api internal model_ratio to USD/1M tokens.
const PlatformUSDPerModelRatio = 2.0

// GlobalModelPricingUSD resolves USD/1M prices from System Settings → Group & Model
// Pricing (ModelPrice / ModelRatio / CompletionRatio / CacheRatio). Tries the
// canonical model name and ModelNameCandidates aliases (e.g. minimax-m3 ↔ MiniMax-M3).
func GlobalModelPricingUSD(canonical string) (input, output, cache, cacheCreation float64, ok bool) {
	for _, name := range ModelPricingLookupNames(canonical) {
		// Price-based (quota_type=1: per-request/per-second/per-image, e.g.
		// sora/kling/gpt-image) has no "output token" axis at all — don't run
		// completion_ratio derivation here. GetCompletionRatio falls back to
		// newapi's stock hardcoded per-model-family default when nothing is
		// configured, which fabricates a bogus non-zero "output price" for
		// these models (completion_ratio is a token-billing concept).
		if price, usePrice := ratio_setting.GetModelPrice(name, false); usePrice && price > 0 {
			input = price
			return input, 0, 0, 0, true
		}
		if ratio, success, _ := ratio_setting.GetModelRatio(name); success && ratio > 0 {
			input = ratio * PlatformUSDPerModelRatio
			fillGlobalDerivedPrices(name, input, &output, &cache, &cacheCreation)
			return input, output, cache, cacheCreation, true
		}
	}
	return 0, 0, 0, 0, false
}

func fillGlobalDerivedPrices(name string, input float64, output, cache, cacheCreation *float64) {
	if input <= 0 {
		return
	}
	if comp := ratio_setting.GetCompletionRatio(name); comp > 0 {
		*output = input * comp
	}
	if cr, crOk := ratio_setting.GetCacheRatio(name); crOk && cr > 0 {
		*cache = input * cr
	}
	if cc, ccOk := ratio_setting.GetCreateCacheRatio(name); ccOk && cc > 0 {
		*cacheCreation = input * cc
	}
}

// modelPricingLookupNames expands canonical ids and provider aliases (MiniMax-M3 ↔ minimax-m3).
func ModelPricingLookupNames(name string) []string {
	out := appendUniqueStrings(ModelNameCandidates(name), name)
	for canonical, aliases := range ModelIDCandidates {
		for _, alias := range aliases {
			if strings.EqualFold(alias, name) {
				out = appendUniqueStrings(out, canonical, alias)
			}
		}
	}
	return out
}
