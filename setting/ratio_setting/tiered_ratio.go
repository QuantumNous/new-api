package ratio_setting

import (
	"github.com/QuantumNous/new-api/types"
)

// TieredPricingTier defines a pricing tier for a model.
// When prompt-side tokens >= Threshold, the ratios in this tier override the base ratios.
// Tiers should be sorted by Threshold in ascending order.
type TieredPricingTier struct {
	Threshold       int     `json:"threshold"`
	ModelRatio      float64 `json:"model_ratio"`
	CompletionRatio float64 `json:"completion_ratio"`
	CacheRatio      float64 `json:"cache_ratio"`
}

// Default tiered pricing for models that have context-based pricing tiers.
// Key is model name, value is list of tiers (sorted by threshold ascending).
// The first tier (threshold=0) is not needed here — it uses the base ratios from modelRatioMap etc.
// Only tiers above the base need to be listed.
var defaultTieredPricing = map[string][]TieredPricingTier{
	// gpt-4.1: base $2/1M input, $8/1M output; 200K+: $4/1M input, $8/1M output (doubled input, same output)
	"gpt-4.1":             {{Threshold: 200000, ModelRatio: 2.0, CompletionRatio: 2.0, CacheRatio: 0.5}},
	"gpt-4.1-2025-04-14":  {{Threshold: 200000, ModelRatio: 2.0, CompletionRatio: 2.0, CacheRatio: 0.5}},
	"gpt-4.1-mini":        {{Threshold: 200000, ModelRatio: 0.4, CompletionRatio: 4.0, CacheRatio: 0.5}},
	"gpt-4.1-mini-2025-04-14": {{Threshold: 200000, ModelRatio: 0.4, CompletionRatio: 4.0, CacheRatio: 0.5}},
	"gpt-4.1-nano":        {{Threshold: 200000, ModelRatio: 0.1, CompletionRatio: 4.0, CacheRatio: 0.5}},
	"gpt-4.1-nano-2025-04-14": {{Threshold: 200000, ModelRatio: 0.1, CompletionRatio: 4.0, CacheRatio: 0.5}},
	// gpt-5: base $1.25/1M input, $10/1M output; 272K+: $2.5/1M input, $15/1M output
	"gpt-5":               {{Threshold: 272000, ModelRatio: 1.25, CompletionRatio: 6.0, CacheRatio: 0.2}},
	"gpt-5-2025-08-07":    {{Threshold: 272000, ModelRatio: 1.25, CompletionRatio: 6.0, CacheRatio: 0.2}},
	"gpt-5-chat-latest":   {{Threshold: 272000, ModelRatio: 1.25, CompletionRatio: 6.0, CacheRatio: 0.2}},
	"gpt-5-mini":          {{Threshold: 272000, ModelRatio: 0.25, CompletionRatio: 6.0, CacheRatio: 0.2}},
	"gpt-5-mini-2025-08-07": {{Threshold: 272000, ModelRatio: 0.25, CompletionRatio: 6.0, CacheRatio: 0.2}},
	"gpt-5-nano":          {{Threshold: 272000, ModelRatio: 0.05, CompletionRatio: 6.0, CacheRatio: 0.2}},
	"gpt-5-nano-2025-08-07": {{Threshold: 272000, ModelRatio: 0.05, CompletionRatio: 6.0, CacheRatio: 0.2}},
}

var tieredPricingMap = types.NewRWMap[string, []TieredPricingTier]()

func TieredPricing2JSONString() string {
	return tieredPricingMap.MarshalJSONString()
}

func UpdateTieredPricingByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(tieredPricingMap, jsonStr, InvalidateExposedDataCache)
}

func GetTieredPricingCopy() map[string][]TieredPricingTier {
	return tieredPricingMap.ReadAll()
}

// GetTieredPricing returns the tiered pricing tiers for a model.
// Returns nil if the model has no tiered pricing.
func GetTieredPricing(name string) []TieredPricingTier {
	name = FormatMatchingModelName(name)
	tiers, ok := tieredPricingMap.Get(name)
	if !ok || len(tiers) == 0 {
		return nil
	}
	return tiers
}

// ResolveTieredPricing determines the active tier based on prompt-side token count.
// Returns the tier if prompt tokens exceed a threshold, nil otherwise (use base ratios).
func ResolveTieredPricing(name string, promptSideTokens int) *TieredPricingTier {
	tiers := GetTieredPricing(name)
	if tiers == nil {
		return nil
	}

	// Find the highest tier whose threshold is <= promptSideTokens
	var activeTier *TieredPricingTier
	for i := range tiers {
		if promptSideTokens >= tiers[i].Threshold {
			activeTier = &tiers[i]
		} else {
			break
		}
	}
	return activeTier
}

// GetHighestTier returns the highest (most expensive) tier for a model.
// Used for conservative pre-consumption estimation.
func GetHighestTier(name string) *TieredPricingTier {
	tiers := GetTieredPricing(name)
	if tiers == nil {
		return nil
	}
	return &tiers[len(tiers)-1]
}
