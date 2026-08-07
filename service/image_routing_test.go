package service

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func imageRoutingInfoForServiceTest(t *testing.T, routeIndex int) *relaycommon.RelayInfo {
	t.Helper()
	plan, err := (types.ImageRoutingConfig{
		Enabled:     true,
		PublicModel: "image-auto",
		PublicGroup: "imageauto",
		MaxN:        4,
		Routes: []types.ImageRoutingRoute{
			{ID: "alt", ChannelID: 36, Priority: 2, Enabled: true, BillingMode: types.ImageRoutingBillingFixed, UpstreamModel: "gpt-image-2", FixedQuotaPerImage: 100000},
			{ID: "enterprise", ChannelID: 108, Priority: 1, Enabled: true, BillingMode: types.ImageRoutingBillingMetered,
				UpstreamModel: "gpt-image-2", BillingModel: "gpt-image-2", BillingGroup: "GPT企业旗舰",
				ReserveQuotaByQuality:      map[string]int{"low": 400000, "medium": 800000, "high": 2000000},
				MissingUsageQuotaByQuality: map[string]int{"low": 100000, "medium": 400000, "high": 1600000}},
		},
	}).BuildPlan("low", 3)
	require.NoError(t, err)
	state := relaycommon.NewImageRoutingState(plan)
	require.NoError(t, state.ActivateRoute(routeIndex))
	return &relaycommon.RelayInfo{ImageRouting: state}
}

func TestFinalizeImageRoutingSettlementBillsFixedRouteByActualCount(t *testing.T) {
	info := imageRoutingInfoForServiceTest(t, 0)
	info.PriceData.AddOtherRatio("n", 2)

	require.NoError(t, FinalizeImageRoutingSettlement(info, &dto.Usage{}))
	require.Equal(t, 200000, info.ImageRouting.FinalQuotaOverride)
}

func TestFinalizeImageRoutingSettlementUsesFallbackOnlyWhenUsageAbsent(t *testing.T) {
	info := imageRoutingInfoForServiceTest(t, 1)
	info.PriceData.AddOtherRatio("n", 2)

	require.NoError(t, FinalizeImageRoutingSettlement(info, &dto.Usage{}))
	require.Equal(t, 200000, info.ImageRouting.FinalQuotaOverride)
	require.True(t, info.ImageRouting.MissingUsageFallback)

	info = imageRoutingInfoForServiceTest(t, 1)
	require.NoError(t, FinalizeImageRoutingSettlement(info, &dto.Usage{PromptTokens: 10, TotalTokens: 10}))
	require.Zero(t, info.ImageRouting.FinalQuotaOverride)
	require.False(t, info.ImageRouting.MissingUsageFallback)
}

func TestFinalizeImageRoutingSettlementUsesFallbackForTotalOnlyUsage(t *testing.T) {
	info := imageRoutingInfoForServiceTest(t, 1)

	require.NoError(t, FinalizeImageRoutingSettlement(info, &dto.Usage{TotalTokens: 10}))
	require.Equal(t, 300000, info.ImageRouting.FinalQuotaOverride)
	require.True(t, info.ImageRouting.FinalQuotaOverrideSet)
	require.True(t, info.ImageRouting.MissingUsageFallback)
}

func TestResolveImageRoutingQuotaUsesOverrideAndCapsMeteredUsage(t *testing.T) {
	fixed := imageRoutingInfoForServiceTest(t, 0)
	fixed.ImageRouting.FinalQuotaOverride = 200000
	quota, breached := ResolveImageRoutingQuota(fixed, 1)
	require.Equal(t, 200000, quota)
	require.False(t, breached)
	fixed.ImageRouting.FinalQuotaOverride = fixed.ImageRouting.Plan.ReserveQuota + 1
	quota, breached = ResolveImageRoutingQuota(fixed, 1)
	require.Equal(t, 300000, quota, "the active fixed route keeps its own request reserve")
	require.True(t, breached)

	metered := imageRoutingInfoForServiceTest(t, 1)
	quota, breached = ResolveImageRoutingQuota(metered, 5000000)
	require.Equal(t, metered.ImageRouting.Plan.ReserveQuota, quota)
	require.True(t, breached)
}

func TestResolveImageRoutingQuotaCapsAtActiveRouteReserve(t *testing.T) {
	plan, err := (types.ImageRoutingConfig{
		Enabled:     true,
		PublicModel: "image-auto",
		PublicGroup: "imageauto",
		MaxN:        1,
		Routes: []types.ImageRoutingRoute{
			{
				ID:            "enterprise",
				ChannelID:     108,
				Priority:      2,
				Enabled:       true,
				BillingMode:   types.ImageRoutingBillingMetered,
				UpstreamModel: "gpt-image-2",
				BillingModel:  "gpt-image-2",
				BillingGroup:  "enterprise",
				ReserveQuotaByQuality: map[string]int{
					"low": 400000,
				},
				MissingUsageQuotaByQuality: map[string]int{
					"low": 100000,
				},
			},
			{
				ID:                 "premium-backup",
				ChannelID:          109,
				Priority:           1,
				Enabled:            true,
				BillingMode:        types.ImageRoutingBillingFixed,
				UpstreamModel:      "premium-image",
				FixedQuotaPerImage: 2000000,
			},
		},
	}).BuildPlan("low", 1)
	require.NoError(t, err)
	require.Equal(t, 2000000, plan.ReserveQuota, "the request reserve still covers the most expensive candidate")

	state := relaycommon.NewImageRoutingState(plan)
	require.NoError(t, state.ActivateRoute(0))
	info := &relaycommon.RelayInfo{ImageRouting: state}

	quota, breached := ResolveImageRoutingQuota(info, 500000)

	require.Equal(t, 400000, quota, "the active Enterprise route must not inherit a more expensive backup's cap")
	require.True(t, breached)
}
