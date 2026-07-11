package modelroute

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveEffectiveModelIdentity(t *testing.T) {
	eff, mapped, err := ResolveEffectiveModel("gpt-5.6", "")
	require.NoError(t, err)
	assert.Equal(t, "gpt-5.6", eff)
	assert.False(t, mapped)
}

func TestResolveEffectiveModelChain(t *testing.T) {
	// a -> b -> c
	mapping := `{"a":"b","b":"c"}`
	eff, mapped, err := ResolveEffectiveModel("a", mapping)
	require.NoError(t, err)
	assert.True(t, mapped)
	assert.Equal(t, "c", eff)
}

func TestResolveEffectiveModelCycle(t *testing.T) {
	mapping := `{"a":"b","b":"a"}`
	_, _, err := ResolveEffectiveModel("a", mapping)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cycle")
}

func TestResolveEffectiveModelSelfMap(t *testing.T) {
	mapping := `{"gpt-5.6":"gpt-5.6"}`
	eff, mapped, err := ResolveEffectiveModel("gpt-5.6", mapping)
	require.NoError(t, err)
	assert.False(t, mapped)
	assert.Equal(t, "gpt-5.6", eff)
}

func TestMakeKeys(t *testing.T) {
	pk := MakePolicyKey(12, "gpt-5.6")
	mk := MakeMetricsKey(12, "provider-x/model-v3")
	assert.Equal(t, int64(12), pk.ChannelID)
	assert.NotEqual(t, pk.String(), mk.String())
}

func TestBuildResolvedCandidateKeepsPolicyPriority(t *testing.T) {
	metrics := &model.ChannelModelMetrics{
		ChannelID:      12,
		EffectiveModel: "provider-x/model-v3",
		RouteState:     string(model.RouteHealthy),
	}
	pA := &model.ChannelModelPolicy{ChannelID: 12, RequestedModel: "gpt-5.6", ManualPriority: 100, Enabled: true}
	pB := &model.ChannelModelPolicy{ChannelID: 12, RequestedModel: "gpt-5.6-latest", ManualPriority: 60, Enabled: true}

	cA := BuildResolvedCandidate(pA, metrics, "provider-x/model-v3")
	cB := BuildResolvedCandidate(pB, metrics, "provider-x/model-v3")
	assert.Equal(t, 100, cA.ManualPriority)
	assert.Equal(t, 60, cB.ManualPriority)
	assert.Same(t, cA.Metrics, cB.Metrics)
	assert.Equal(t, "gpt-5.6-latest", cB.RequestedModel)
}

func TestDeduplicateCandidates(t *testing.T) {
	cands := []model.ResolvedRouteCandidate{
		{ChannelID: 1, RequestedModel: "m", ManualPriority: 100},
		{ChannelID: 1, RequestedModel: "m", ManualPriority: 50},
		{ChannelID: 2, RequestedModel: "m", ManualPriority: 80},
	}
	out := DeduplicateCandidates(cands)
	require.Len(t, out, 2)
	assert.Equal(t, int64(1), out[0].ChannelID)
	assert.Equal(t, 100, out[0].ManualPriority)
	assert.Equal(t, int64(2), out[1].ChannelID)
}

func TestSortCandidatesForProduction(t *testing.T) {
	scoreHigh := 0.9
	scoreLow := 0.2
	cands := []model.ResolvedRouteCandidate{
		{ChannelID: 3, ManualPriority: 50, Metrics: &model.ChannelModelMetrics{RouteState: string(model.RouteUnknown)}},
		{ChannelID: 1, ManualPriority: 100, Metrics: &model.ChannelModelMetrics{RouteState: string(model.RouteHealthy), ExperienceScore: &scoreLow}},
		{ChannelID: 2, ManualPriority: 100, Metrics: &model.ChannelModelMetrics{RouteState: string(model.RouteHealthy), ExperienceScore: &scoreHigh}},
		{ChannelID: 4, ManualPriority: 200, Metrics: &model.ChannelModelMetrics{RouteState: string(model.RouteOpen)}},
	}
	SortCandidatesForProduction(cands)
	// HEALTHY first (priority then score): channel 2 score 0.9 before channel 1 score 0.2, both priority 100
	assert.Equal(t, int64(2), cands[0].ChannelID)
	assert.Equal(t, int64(1), cands[1].ChannelID)
	// then UNKNOWN
	assert.Equal(t, int64(3), cands[2].ChannelID)
	// OPEN last among remaining
	assert.Equal(t, int64(4), cands[3].ChannelID)
}

func TestRoutePlanCache(t *testing.T) {
	InvalidateAllRoutePlans()
	plan := &model.RoutePlan{
		RequestedModel: "gpt-5.6",
		Primary:        &model.ResolvedRouteCandidate{ChannelID: 9, ManualPriority: 10},
	}
	StoreRoutePlan(plan)
	got := GetCachedRoutePlan("gpt-5.6")
	require.NotNil(t, got)
	require.NotNil(t, got.Primary)
	assert.Equal(t, int64(9), got.Primary.ChannelID)

	InvalidateRoutePlan("gpt-5.6")
	assert.Nil(t, GetCachedRoutePlan("gpt-5.6"))
}

func TestRemainingCandidatesExcluding(t *testing.T) {
	all := []model.ResolvedRouteCandidate{
		{ChannelID: 1}, {ChannelID: 2}, {ChannelID: 3},
	}
	primary := &model.ResolvedRouteCandidate{ChannelID: 1}
	lease := &model.ResolvedRouteCandidate{ChannelID: 2}
	out := RemainingCandidatesExcluding(all, primary, lease)
	require.Len(t, out, 1)
	assert.Equal(t, int64(3), out[0].ChannelID)
}

func TestDiscoverFromChannel(t *testing.T) {
	mapping := `{"gpt-5.6":"provider-x/model-v3","gpt-5.6-latest":"provider-x/model-v3"}`
	pri := int64(42)
	ch := &model.Channel{
		Id:           12,
		Models:       "gpt-5.6,gpt-4o",
		ModelMapping: &mapping,
		Priority:     &pri,
	}
	pairs := DiscoverFromChannel(ch)
	require.NotEmpty(t, pairs)

	byReq := map[string]DiscoveredModelPair{}
	for _, p := range pairs {
		byReq[p.RequestedModel] = p
	}
	require.Contains(t, byReq, "gpt-5.6")
	assert.Equal(t, "provider-x/model-v3", byReq["gpt-5.6"].EffectiveModel)
	assert.Equal(t, 42, byReq["gpt-5.6"].ManualPriority)
	// mapped source for keys present in mapping
	assert.Equal(t, model.PolicySourceMapped, byReq["gpt-5.6"].Source)
	require.Contains(t, byReq, "gpt-4o")
	assert.Equal(t, "gpt-4o", byReq["gpt-4o"].EffectiveModel)
	require.Contains(t, byReq, "gpt-5.6-latest")
	assert.Equal(t, "provider-x/model-v3", byReq["gpt-5.6-latest"].EffectiveModel)
}

func TestBuildRoutePlanFromPoliciesWithStub(t *testing.T) {
	// unit-level: inject candidates via BuildResolvedCandidate + manual plan assembly path
	// full DB path covered separately when model package TestMain is available
	metrics := &model.ChannelModelMetrics{ChannelID: 1, EffectiveModel: "m", RouteState: string(model.RouteHealthy)}
	p1 := &model.ChannelModelPolicy{ChannelID: 1, RequestedModel: "m", ManualPriority: 10, Enabled: true}
	p2 := &model.ChannelModelPolicy{ChannelID: 2, RequestedModel: "m", ManualPriority: 20, Enabled: true}
	c1 := BuildResolvedCandidate(p1, metrics, "m")
	c2 := BuildResolvedCandidate(p2, metrics, "m")
	cands := []model.ResolvedRouteCandidate{c1, c2}
	SortCandidatesForProduction(cands)
	assert.Equal(t, int64(2), cands[0].ChannelID) // higher manual_priority

	plan := &model.RoutePlan{RequestedModel: "m", Primary: &cands[0]}
	for i := 1; i < len(cands); i++ {
		cp := cands[i]
		plan.OverflowChain = append(plan.OverflowChain, &cp)
	}
	StoreRoutePlan(plan)
	chain, err := BuildProductionCandidateChain("m")
	require.NoError(t, err)
	require.NotEmpty(t, chain)
	assert.Equal(t, int64(2), chain[0].ChannelID)
	InvalidateAllRoutePlans()
}

func TestIsModelPriorityModeDefault(t *testing.T) {
	// reset to channel (legacy)
	SetRoutingPriorityMode(model.RoutingPriorityModeChannel)
	assert.False(t, IsModelPriorityMode())
	SetRoutingPriorityMode(model.RoutingPriorityModeModel)
	assert.True(t, IsModelPriorityMode())
	SetRoutingPriorityMode(model.RoutingPriorityModeChannel)
	assert.False(t, IsModelPriorityMode())
}
