package service

import (
	"net/http/httptest"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGenerateTextOtherInfoIncludesBillingQuotaTypeForTierPricing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	now := time.Now()

	relayInfo := &relaycommon.RelayInfo{
		StartTime:         now,
		FirstResponseTime: now,
		ChannelMeta:       &relaycommon.ChannelMeta{},
		PriceData: types.PriceData{
			UsePrice: false,
			TierPricing: &types.TierPricingMeta{
				Enabled:    true,
				Basis:      "prompt_tokens",
				TierIndex:  1,
				MinTokens:  200000,
				BasisValue: 200321,
			},
		},
	}

	other := GenerateTextOtherInfo(ctx, relayInfo, 2, 1, 4.5, 0, 0.1, 0, -1)

	require.Equal(t, 0, other["billing_quota_type"])
	require.Equal(t, true, other["tier_pricing_enabled"])
	require.Equal(t, 1, other["tier_index"])
	require.Equal(t, 200321, other["tier_basis_value"])
}

func TestGenerateTextOtherInfoIncludesBillingQuotaTypeForPerCallPricing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	now := time.Now()

	relayInfo := &relaycommon.RelayInfo{
		StartTime:         now,
		FirstResponseTime: now,
		ChannelMeta:       &relaycommon.ChannelMeta{},
		PriceData: types.PriceData{
			UsePrice: true,
		},
	}

	other := GenerateTextOtherInfo(ctx, relayInfo, 0, 1, 0, 0, 0, 0.02, -1)

	require.Equal(t, 1, other["billing_quota_type"])
}
