package ratio_setting

import (
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

const TierPricingBasisPromptTokens = "prompt_tokens"

var modelTierPricingMap = types.NewRWMap[string, types.ModelTierPricingConfig]()

func cloneMaxTokens(maxTokens *int) *int {
	if maxTokens == nil {
		return nil
	}
	value := *maxTokens
	return &value
}

func cloneFloat64(value *float64) *float64 {
	if value == nil {
		return nil
	}
	cloned := *value
	return &cloned
}

func cloneTier(tier types.ModelTierPricingTier) types.ModelTierPricingTier {
	cloned := tier
	cloned.MaxTokens = cloneMaxTokens(tier.MaxTokens)
	cloned.CacheReadPrice = cloneFloat64(tier.CacheReadPrice)
	return cloned
}

func cloneTierPricingConfig(config types.ModelTierPricingConfig) types.ModelTierPricingConfig {
	cloned := config
	cloned.Tiers = make([]types.ModelTierPricingTier, 0, len(config.Tiers))
	for _, tier := range config.Tiers {
		cloned.Tiers = append(cloned.Tiers, cloneTier(tier))
	}
	return cloned
}

func normalizeTierPricingConfig(config types.ModelTierPricingConfig) (types.ModelTierPricingConfig, error) {
	normalized := cloneTierPricingConfig(config)
	normalized.Basis = strings.TrimSpace(normalized.Basis)
	if normalized.Basis == "" {
		normalized.Basis = TierPricingBasisPromptTokens
	}
	if normalized.Basis != TierPricingBasisPromptTokens {
		return types.ModelTierPricingConfig{}, fmt.Errorf("unsupported tier pricing basis: %s", normalized.Basis)
	}
	if len(normalized.Tiers) == 0 {
		if normalized.Enabled {
			return types.ModelTierPricingConfig{}, fmt.Errorf("tier pricing requires at least one tier")
		}
		return normalized, nil
	}

	sort.Slice(normalized.Tiers, func(i, j int) bool {
		return normalized.Tiers[i].MinTokens < normalized.Tiers[j].MinTokens
	})

	for index, tier := range normalized.Tiers {
		if tier.MinTokens < 0 {
			return types.ModelTierPricingConfig{}, fmt.Errorf("tier %d min_tokens cannot be negative", index)
		}
		if tier.InputPrice < 0 || tier.CompletionPrice < 0 {
			return types.ModelTierPricingConfig{}, fmt.Errorf("tier %d prices cannot be negative", index)
		}
		if tier.CacheReadPrice != nil && *tier.CacheReadPrice < 0 {
			return types.ModelTierPricingConfig{}, fmt.Errorf("tier %d cache_read_price cannot be negative", index)
		}
		if tier.InputPrice == 0 && tier.CompletionPrice != 0 {
			return types.ModelTierPricingConfig{}, fmt.Errorf("tier %d cannot set completion price when input price is 0", index)
		}
		if tier.InputPrice == 0 && tier.CacheReadPrice != nil && *tier.CacheReadPrice != 0 {
			return types.ModelTierPricingConfig{}, fmt.Errorf("tier %d cannot set cache price when input price is 0", index)
		}
		if index == 0 && tier.MinTokens != 0 {
			return types.ModelTierPricingConfig{}, fmt.Errorf("first tier must start from 0")
		}
		if tier.MaxTokens == nil {
			if index != len(normalized.Tiers)-1 {
				return types.ModelTierPricingConfig{}, fmt.Errorf("only the final tier may omit max_tokens")
			}
			continue
		}
		if *tier.MaxTokens <= tier.MinTokens {
			return types.ModelTierPricingConfig{}, fmt.Errorf("tier %d max_tokens must be greater than min_tokens", index)
		}
		if index == len(normalized.Tiers)-1 {
			return types.ModelTierPricingConfig{}, fmt.Errorf("final tier must omit max_tokens")
		}
		nextTier := normalized.Tiers[index+1]
		if nextTier.MinTokens != *tier.MaxTokens {
			return types.ModelTierPricingConfig{}, fmt.Errorf("tiers must be contiguous without gaps or overlaps")
		}
	}

	return normalized, nil
}

func ModelTierPricing2JSONString() string {
	return modelTierPricingMap.MarshalJSONString()
}

func UpdateModelTierPricingByJSONString(jsonStr string) error {
	if strings.TrimSpace(jsonStr) == "" {
		jsonStr = "{}"
	}

	parsed := make(map[string]types.ModelTierPricingConfig)
	if err := common.UnmarshalJsonStr(jsonStr, &parsed); err != nil {
		return err
	}

	normalized := make(map[string]types.ModelTierPricingConfig, len(parsed))
	for modelName, config := range parsed {
		normalizedConfig, err := normalizeTierPricingConfig(config)
		if err != nil {
			return fmt.Errorf("model %s: %w", modelName, err)
		}
		completionRatioInfo := GetCompletionRatioInfo(modelName)
		if completionRatioInfo.Locked && (normalizedConfig.Enabled || len(normalizedConfig.Tiers) > 0) {
			return fmt.Errorf("model %s: tier pricing is not supported because completion ratio is locked", modelName)
		}
		normalized[modelName] = normalizedConfig
	}

	jsonBytes, err := common.Marshal(normalized)
	if err != nil {
		return err
	}
	return types.LoadFromJsonStringWithCallback(modelTierPricingMap, string(jsonBytes), InvalidateExposedDataCache)
}

func GetModelTierPricing(modelName string) (types.ModelTierPricingConfig, bool) {
	if config, ok := modelTierPricingMap.Get(modelName); ok {
		return cloneTierPricingConfig(config), true
	}
	formattedModelName := FormatMatchingModelName(modelName)
	if formattedModelName != modelName {
		if config, ok := modelTierPricingMap.Get(formattedModelName); ok {
			return cloneTierPricingConfig(config), true
		}
	}
	return types.ModelTierPricingConfig{}, false
}

func HasEnabledModelTierPricing(modelName string) bool {
	config, ok := GetModelTierPricing(modelName)
	return ok && config.Enabled && len(config.Tiers) > 0
}

func GetModelTierPricingBaseRatio(modelName string) (float64, bool) {
	config, ok := GetModelTierPricing(modelName)
	if !ok || !config.Enabled || len(config.Tiers) == 0 {
		return 0, false
	}
	return config.Tiers[0].InputPrice / 2, true
}

func GetModelTierPricingCopy() map[string]types.ModelTierPricingConfig {
	raw := modelTierPricingMap.ReadAll()
	cloned := make(map[string]types.ModelTierPricingConfig, len(raw))
	for modelName, config := range raw {
		cloned[modelName] = cloneTierPricingConfig(config)
	}
	return cloned
}

func resolveBaseCacheRatio(priceData types.PriceData) float64 {
	if priceData.TierPricing != nil && priceData.TierPricing.BaseCacheRatio != nil {
		return *priceData.TierPricing.BaseCacheRatio
	}
	return priceData.CacheRatio
}

func ApplyModelTierPricing(modelName string, priceData types.PriceData, promptTokens int) (types.PriceData, bool) {
	config, ok := GetModelTierPricing(modelName)
	if !ok || !config.Enabled || config.Basis != TierPricingBasisPromptTokens {
		return priceData, false
	}

	baseCacheRatio := resolveBaseCacheRatio(priceData)

	for index, tier := range config.Tiers {
		if promptTokens < tier.MinTokens {
			continue
		}
		if tier.MaxTokens != nil && promptTokens >= *tier.MaxTokens {
			continue
		}

		nextPriceData := priceData
		nextPriceData.UsePrice = false
		nextPriceData.ModelPrice = 0
		nextPriceData.ModelRatio = tier.InputPrice / 2
		nextPriceData.CacheRatio = baseCacheRatio
		if tier.InputPrice == 0 {
			nextPriceData.CompletionRatio = 0
			if tier.CacheReadPrice != nil {
				nextPriceData.CacheRatio = 0
			}
		} else {
			nextPriceData.CompletionRatio = tier.CompletionPrice / tier.InputPrice
			if tier.CacheReadPrice != nil {
				nextPriceData.CacheRatio = *tier.CacheReadPrice / tier.InputPrice
			}
		}
		nextPriceData.TierPricing = &types.TierPricingMeta{
			Enabled:        true,
			Basis:          config.Basis,
			TierIndex:      index,
			MinTokens:      tier.MinTokens,
			MaxTokens:      cloneMaxTokens(tier.MaxTokens),
			BasisValue:     promptTokens,
			BaseCacheRatio: cloneFloat64(&baseCacheRatio),
		}
		return nextPriceData, true
	}

	return priceData, false
}
