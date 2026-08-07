package common

import (
	"testing"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func imageRoutingPlanForStateTest(t *testing.T) *types.ImageRoutingPlan {
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
	}).BuildPlan("high", 2)
	require.NoError(t, err)
	return plan
}

func TestImageRoutingStateBillsFixedRouteByReturnedImages(t *testing.T) {
	state := NewImageRoutingState(imageRoutingPlanForStateTest(t))
	require.NoError(t, state.ActivateRoute(0))
	require.Empty(t, state.AttemptedChannelIDs)
	require.NoError(t, state.RecordActiveRouteAttempt())
	require.NoError(t, state.PrepareSettlement(1, true))

	require.Equal(t, 100000, state.FinalQuotaOverride)
	require.Equal(t, []int{36}, state.AttemptedChannelIDs)
	require.Equal(t, "fixed", state.BillingMode())
}

func TestImageRoutingStateUsesMissingUsageFallbackAndCapsBreach(t *testing.T) {
	state := NewImageRoutingState(imageRoutingPlanForStateTest(t))
	require.NoError(t, state.ActivateRoute(1))
	require.NoError(t, state.PrepareSettlement(2, false))
	require.Equal(t, 3200000, state.FinalQuotaOverride)
	require.True(t, state.MissingUsageFallback)

	actual, breached := state.CapActualQuota(5000000)
	require.Equal(t, state.Plan.ReserveQuota, actual)
	require.True(t, breached)
	require.True(t, state.ReserveBreach)
}

func TestImageRoutingStateCannotActivateRouteTwice(t *testing.T) {
	state := NewImageRoutingState(imageRoutingPlanForStateTest(t))
	require.NoError(t, state.ActivateRoute(0))
	require.NoError(t, state.RecordActiveRouteAttempt())
	require.ErrorContains(t, state.RecordActiveRouteAttempt(), "already dispatched")
	require.ErrorContains(t, state.ActivateRoute(0), "already attempted")
}

func TestImageRoutingStateClonesRequestStartPricingSnapshot(t *testing.T) {
	state := NewImageRoutingState(imageRoutingPlanForStateTest(t))
	require.NoError(t, state.ActivateRoute(1))
	price := types.PriceData{ModelRatio: 1.25}
	price.AddOtherRatio("n", 1)
	input := &billingexpr.RequestInput{Headers: map[string]string{"x-test": "before"}, Body: []byte("body")}
	snapshot := ImageRoutingPriceSnapshot{
		PriceData:             price,
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{ExprString: "p + c", GroupRatio: 1.4},
		BillingRequestInput:   input,
	}
	require.NoError(t, state.SetRoutePricing(1, snapshot))

	price.AddOtherRatio("n", 9)
	input.Headers["x-test"] = "mutated"
	input.Body[0] = 'X'
	snapshot.TieredBillingSnapshot.ExprString = "mutated"

	got, err := state.ActiveRoutePricing()
	require.NoError(t, err)
	require.Equal(t, 1.0, got.PriceData.OtherRatios()["n"])
	require.Equal(t, "before", got.BillingRequestInput.Headers["x-test"])
	require.Equal(t, []byte("body"), got.BillingRequestInput.Body)
	require.Equal(t, "p + c", got.TieredBillingSnapshot.ExprString)
}
