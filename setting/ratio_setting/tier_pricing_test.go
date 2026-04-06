package ratio_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/types"

	"github.com/stretchr/testify/require"
)

func intPtr(value int) *int {
	return &value
}

func resetModelTierPricingForTest(t *testing.T) {
	t.Helper()
	require.NoError(t, UpdateModelTierPricingByJSONString("{}"))
	t.Cleanup(func() {
		require.NoError(t, UpdateModelTierPricingByJSONString("{}"))
	})
}

func TestUpdateModelTierPricingByJSONStringValidation(t *testing.T) {
	resetModelTierPricingForTest(t)

	t.Run("empty json", func(t *testing.T) {
		require.NoError(t, UpdateModelTierPricingByJSONString(""))
		require.Empty(t, GetModelTierPricingCopy())
	})

	t.Run("invalid json", func(t *testing.T) {
		err := UpdateModelTierPricingByJSONString("{")
		require.Error(t, err)
	})

	t.Run("first tier must start at zero", func(t *testing.T) {
		err := UpdateModelTierPricingByJSONString(`{
  "google/gemini-3.1-pro-preview": {
    "enabled": true,
    "basis": "prompt_tokens",
    "tiers": [
      {
        "min_tokens": 1,
        "max_tokens": 200000,
        "input_price": 2,
        "completion_price": 12,
        "cache_read_price": 0.2
      },
      {
        "min_tokens": 200000,
        "input_price": 4,
        "completion_price": 18,
        "cache_read_price": 0.4
      }
    ]
  }
}`)
		require.Error(t, err)
	})

	t.Run("tiers must be contiguous", func(t *testing.T) {
		err := UpdateModelTierPricingByJSONString(`{
  "google/gemini-3.1-pro-preview": {
    "enabled": true,
    "basis": "prompt_tokens",
    "tiers": [
      {
        "min_tokens": 0,
        "max_tokens": 100000,
        "input_price": 2,
        "completion_price": 12,
        "cache_read_price": 0.2
      },
      {
        "min_tokens": 100001,
        "input_price": 4,
        "completion_price": 18,
        "cache_read_price": 0.4
      }
    ]
  }
}`)
		require.Error(t, err)
	})

	t.Run("final tier must omit max tokens", func(t *testing.T) {
		err := UpdateModelTierPricingByJSONString(`{
  "google/gemini-3.1-pro-preview": {
    "enabled": true,
    "basis": "prompt_tokens",
    "tiers": [
      {
        "min_tokens": 0,
        "max_tokens": 200000,
        "input_price": 2,
        "completion_price": 12,
        "cache_read_price": 0.2
      },
      {
        "min_tokens": 200000,
        "max_tokens": 300000,
        "input_price": 4,
        "completion_price": 18,
        "cache_read_price": 0.4
      }
    ]
  }
}`)
		require.Error(t, err)
	})

	t.Run("locked completion ratio models cannot enable tier pricing", func(t *testing.T) {
		err := UpdateModelTierPricingByJSONString(`{
  "gpt-5": {
    "enabled": true,
    "basis": "prompt_tokens",
    "tiers": [
      {
        "min_tokens": 0,
        "input_price": 2,
        "completion_price": 16
      }
    ]
  }
}`)
		require.Error(t, err)
	})
}

func TestApplyModelTierPricingSelectsTierAndPreservesExtensions(t *testing.T) {
	resetModelTierPricingForTest(t)
	require.NoError(t, UpdateModelTierPricingByJSONString(`{
  "google/gemini-3.1-pro-preview": {
    "enabled": true,
    "basis": "prompt_tokens",
    "tiers": [
      {
        "min_tokens": 0,
        "max_tokens": 200000,
        "input_price": 2,
        "completion_price": 12,
        "cache_read_price": 0.2
      },
      {
        "min_tokens": 200000,
        "input_price": 4,
        "completion_price": 18,
        "cache_read_price": 0.4
      }
    ]
  }
}`))

	basePriceData := types.PriceData{
		ModelRatio:           1,
		CompletionRatio:      6,
		CacheRatio:           0.1,
		CacheCreationRatio:   1.25,
		ImageRatio:           0.5,
		AudioRatio:           0.75,
		AudioCompletionRatio: 2,
	}

	firstTierPriceData, applied := ApplyModelTierPricing("google/gemini-3.1-pro-preview", basePriceData, 199999)
	require.True(t, applied)
	require.Equal(t, 1.0, firstTierPriceData.ModelRatio)
	require.Equal(t, 6.0, firstTierPriceData.CompletionRatio)
	require.Equal(t, 0.1, firstTierPriceData.CacheRatio)
	require.Equal(t, 1.25, firstTierPriceData.CacheCreationRatio)
	require.Equal(t, 0.5, firstTierPriceData.ImageRatio)
	require.Equal(t, 0.75, firstTierPriceData.AudioRatio)
	require.Equal(t, 2.0, firstTierPriceData.AudioCompletionRatio)
	require.NotNil(t, firstTierPriceData.TierPricing)
	require.Equal(t, 0, firstTierPriceData.TierPricing.TierIndex)
	require.Equal(t, 199999, firstTierPriceData.TierPricing.BasisValue)
	require.Equal(t, intPtr(200000), firstTierPriceData.TierPricing.MaxTokens)

	secondTierPriceData, applied := ApplyModelTierPricing("google/gemini-3.1-pro-preview", basePriceData, 200000)
	require.True(t, applied)
	require.Equal(t, 2.0, secondTierPriceData.ModelRatio)
	require.Equal(t, 4.5, secondTierPriceData.CompletionRatio)
	require.Equal(t, 0.1, secondTierPriceData.CacheRatio)
	require.Equal(t, 1.25, secondTierPriceData.CacheCreationRatio)
	require.Equal(t, 0.5, secondTierPriceData.ImageRatio)
	require.Equal(t, 0.75, secondTierPriceData.AudioRatio)
	require.Equal(t, 2.0, secondTierPriceData.AudioCompletionRatio)
	require.NotNil(t, secondTierPriceData.TierPricing)
	require.Equal(t, 1, secondTierPriceData.TierPricing.TierIndex)
	require.Nil(t, secondTierPriceData.TierPricing.MaxTokens)
	require.Equal(t, 200000, secondTierPriceData.TierPricing.BasisValue)
}

func TestApplyModelTierPricingAllowsOptionalCacheReadPrice(t *testing.T) {
	resetModelTierPricingForTest(t)
	require.NoError(t, UpdateModelTierPricingByJSONString(`{
  "google/gemini-3.1-pro-preview": {
    "enabled": true,
    "basis": "prompt_tokens",
    "tiers": [
      {
        "min_tokens": 0,
        "max_tokens": 200000,
        "input_price": 2,
        "completion_price": 12
      },
      {
        "min_tokens": 200000,
        "input_price": 4,
        "completion_price": 18,
        "cache_read_price": 0.4
      }
    ]
  }
}`))

	config, ok := GetModelTierPricing("google/gemini-3.1-pro-preview")
	require.True(t, ok)
	require.Len(t, config.Tiers, 2)
	require.Nil(t, config.Tiers[0].CacheReadPrice)
	require.NotNil(t, config.Tiers[1].CacheReadPrice)
	require.Equal(t, 0.4, *config.Tiers[1].CacheReadPrice)

	basePriceData := types.PriceData{
		ModelRatio:      1,
		CompletionRatio: 6,
		CacheRatio:      0.25,
	}

	firstTierPriceData, applied := ApplyModelTierPricing("google/gemini-3.1-pro-preview", basePriceData, 1000)
	require.True(t, applied)
	require.Equal(t, 0.25, firstTierPriceData.CacheRatio)
	require.Equal(t, 6.0, firstTierPriceData.CompletionRatio)

	secondTierPriceData, applied := ApplyModelTierPricing("google/gemini-3.1-pro-preview", basePriceData, 200000)
	require.True(t, applied)
	require.Equal(t, 0.1, secondTierPriceData.CacheRatio)
	require.Equal(t, 4.5, secondTierPriceData.CompletionRatio)
}

func TestApplyModelTierPricingReapplyRestoresBaseCacheRatioWhenTierOmitsCacheReadPrice(t *testing.T) {
	resetModelTierPricingForTest(t)
	require.NoError(t, UpdateModelTierPricingByJSONString(`{
  "google/gemini-3.1-pro-preview": {
    "enabled": true,
    "basis": "prompt_tokens",
    "tiers": [
      {
        "min_tokens": 0,
        "max_tokens": 200000,
        "input_price": 2,
        "completion_price": 12,
        "cache_read_price": 0.2
      },
      {
        "min_tokens": 200000,
        "input_price": 4,
        "completion_price": 18
      }
    ]
  }
}`))

	basePriceData := types.PriceData{
		ModelRatio:      1,
		CompletionRatio: 6,
		CacheRatio:      0.25,
	}

	firstTierPriceData, applied := ApplyModelTierPricing("google/gemini-3.1-pro-preview", basePriceData, 1000)
	require.True(t, applied)
	require.Equal(t, 0.1, firstTierPriceData.CacheRatio)
	require.NotNil(t, firstTierPriceData.TierPricing)
	require.NotNil(t, firstTierPriceData.TierPricing.BaseCacheRatio)
	require.Equal(t, 0.25, *firstTierPriceData.TierPricing.BaseCacheRatio)

	secondTierPriceData, applied := ApplyModelTierPricing("google/gemini-3.1-pro-preview", firstTierPriceData, 200000)
	require.True(t, applied)
	require.Equal(t, 0.25, secondTierPriceData.CacheRatio)
	require.Equal(t, 4.5, secondTierPriceData.CompletionRatio)
	require.NotNil(t, secondTierPriceData.TierPricing)
	require.NotNil(t, secondTierPriceData.TierPricing.BaseCacheRatio)
	require.Equal(t, 0.25, *secondTierPriceData.TierPricing.BaseCacheRatio)
}

func TestGetModelRatioOrPriceTreatsTierPricingAsConfigured(t *testing.T) {
	resetModelTierPricingForTest(t)
	require.NoError(t, UpdateModelTierPricingByJSONString(`{
  "tier-only-gemini-3.1-pro-preview": {
    "enabled": true,
    "basis": "prompt_tokens",
    "tiers": [
      {
        "min_tokens": 0,
        "max_tokens": 200000,
        "input_price": 2,
        "completion_price": 12
      },
      {
        "min_tokens": 200000,
        "input_price": 4,
        "completion_price": 18
      }
    ]
  }
}`))

	ratio, usePrice, exist := GetModelRatioOrPrice("tier-only-gemini-3.1-pro-preview")
	require.True(t, exist)
	require.False(t, usePrice)
	require.Equal(t, 1.0, ratio)
	require.True(t, HasEnabledModelTierPricing("tier-only-gemini-3.1-pro-preview"))
}
