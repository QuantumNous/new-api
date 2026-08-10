package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// jinn-pro's live ratios: ModelRatio 0.4, CompletionRatio 4.0, CacheRatio 0.2.
func TestShadowCostWeightsOutputByCompletionRatio(t *testing.T) {
	// 1000 input + 100 output → (1000 + 400) × 0.4
	require.Equal(t, int64(560), ShadowCost(1000, 100, 0, 0.4, 4.0, 0.2))
}

func TestShadowCostPricesCachedInputCheaper(t *testing.T) {
	// 1000 input of which 800 cached → (200 + 800×0.2 + 0) × 0.4
	require.Equal(t, int64(144), ShadowCost(1000, 0, 800, 0.4, 4.0, 0.2))
}

// The caller passes GroupRatio 0 tiers here precisely because the real quota is
// zeroed for them; the shadow value must not be.
func TestShadowCostIsIndependentOfGroupRatio(t *testing.T) {
	require.Greater(t, ShadowCost(30000, 1500, 0, 0.4, 4.0, 0.2), int64(0))
}

func TestShadowCostWithNoRatioIsZero(t *testing.T) {
	require.Equal(t, int64(0), ShadowCost(30000, 1500, 0, 0, 4.0, 0.2),
		"an alias with no ModelRatio has no shadow basis and must not be invented")
}

func TestShadowCostClampsNegativeAndOversizedCachedCounts(t *testing.T) {
	require.Equal(t, int64(400), ShadowCost(1000, 0, -50, 0.4, 4.0, 0.2))
	// cached cannot exceed prompt; treat the excess as fully cached
	require.Equal(t, int64(80), ShadowCost(1000, 0, 5000, 0.4, 4.0, 0.2))
}

func TestShadowCostRoundsRatherThanTruncates(t *testing.T) {
	// (3 + 0) × 0.4 = 1.2 → 1
	require.Equal(t, int64(1), ShadowCost(3, 0, 0, 0.4, 4.0, 0.2))
}
