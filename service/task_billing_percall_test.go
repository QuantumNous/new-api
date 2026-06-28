package service

import (
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestIsTaskPerCallBillingDurationBased(t *testing.T) {
	price := types.PriceData{
		UsePrice: true,
		OtherRatios: map[string]float64{
			"seconds": 8,
			"mode":    1,
		},
	}
	require.False(t, IsTaskPerCallBilling("kling-v3-motion-control", price))
}

func TestIsTaskPerCallBillingFlatUsePrice(t *testing.T) {
	price := types.PriceData{UsePrice: true}
	require.True(t, IsTaskPerCallBilling("some-flat-model", price))
}
