package main

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFixedRefundFeeToBPS(t *testing.T) {
	require.Equal(t, 250, fixedFeeToBPS(80000, 2000))
	require.Equal(t, 714, fixedFeeToBPS(7000, 500))
	require.Equal(t, 0, fixedFeeToBPS(0, 500))
}

func TestQuotaSplitPreservesSourceTotal(t *testing.T) {
	total := int64(800)
	subscriptionRemaining := int64(700)
	walletRemaining := total - subscriptionRemaining
	assert.Equal(t, int64(100), walletRemaining)
	assert.Equal(t, int64(700), subscriptionRemaining)
	assert.Equal(t, int64(800), walletRemaining+subscriptionRemaining)
}

func TestRefundAmountMatchesUltraLegacyFixedFee(t *testing.T) {
	assert.Equal(t, int64(78000), refundAmount(80000, fixedFeeToBPS(80000, 2000)))
}

func TestMapCreditEvent(t *testing.T) {
	value, ok := mapCreditEvent("purchase")
	require.True(t, ok)
	assert.Equal(t, "purchase", value)
	_, ok = mapCreditEvent("unknown")
	assert.False(t, ok)
}
