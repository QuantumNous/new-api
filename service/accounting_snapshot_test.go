package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
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

func TestAmountUSDUsesImageCountBilling(t *testing.T) {
	prices := accountingPriceTuple{
		InputPrice: 0.057,
	}
	input := ConsumeAccountingInput{
		BillingMode: accountingBillingModeImageCount,
		ImageCount:  2,
	}

	require.InDelta(t, 0.114, amountUSD(prices, input), 0.0000000000001)
}

func TestAmountUSDUsesDurationBilling(t *testing.T) {
	prices := accountingPriceTuple{
		InputPrice: 0.035,
	}
	input := ConsumeAccountingInput{
		BillingMode:     accountingBillingModeDurationSeconds,
		DurationSeconds: 8,
	}

	require.InDelta(t, 0.28, amountUSD(prices, input), 0.0000000000001)
}

func TestUserAmountsUSDDerivesMediaFinalAmountFromQuota(t *testing.T) {
	prices := accountingPriceTuple{
		InputPrice: 0.057,
	}
	input := ConsumeAccountingInput{
		BillingMode: accountingBillingModeImageCount,
		ImageCount:  1,
		GroupRatio:  1.05,
		Quota:       27794,
	}

	userPriceAmountUSD, userFinalAmountUSD := userAmountsUSD(prices, input)

	require.InDelta(t, float64(27794)/common.QuotaPerUnit, userFinalAmountUSD, 0.0000000000001)
	require.InDelta(t, userFinalAmountUSD/1.05, userPriceAmountUSD, 0.0000000000001)
}
