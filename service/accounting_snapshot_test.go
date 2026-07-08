package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAmountUSDSubtractsCacheInclusiveInput(t *testing.T) {
	prices := accountingPriceTuple{
		InputPrice:         0.1391607,
		OutputPrice:        0.8349642,
		CachePrice:         0.01391607,
		CacheCreationPrice: 0,
	}
	input := ConsumeAccountingInput{
		InputTokens:             10511,
		InputTokensIncludeCache: true,
		OutputTokens:            13,
		CacheReadTokens:         2432,
		CacheWriteTokens:        0,
	}

	require.InDelta(t, 0.0011689777121, amountUSD(prices, input), 0.0000000000001)
}

func TestAmountUSDKeepsCacheExclusiveInput(t *testing.T) {
	prices := accountingPriceTuple{
		InputPrice:         2.5,
		OutputPrice:        15,
		CachePrice:         0.25,
		CacheCreationPrice: 3,
	}
	input := ConsumeAccountingInput{
		InputTokens:             1000,
		InputTokensIncludeCache: false,
		OutputTokens:            10,
		CacheReadTokens:         200,
		CacheWriteTokens:        50,
	}

	require.InDelta(t, 0.00285, amountUSD(prices, input), 0.0000000000001)
}
