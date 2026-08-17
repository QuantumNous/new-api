package intelligent_routing

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPlanChoosesCheapestCandidateMeetingQualityThreshold(t *testing.T) {
	got, err := Plan(PlanInput{
		RequestedModel: "client-model", PolicyVersion: 2,
		Features:     Features{Task: TaskGeneral, PromptTokens: 100, MaxOutputTokens: 50},
		Requirements: Requirements{Capabilities: map[Capability]bool{}, MinimumTier: 1, ContextNeeded: 150},
		Candidates: []Candidate{
			{Model: "cheap", ChannelID: 1, Tier: 1, InputPrice: 1, OutputPrice: 2, ContextLimit: 1000, PredictedSuccess: .92},
			{Model: "premium", ChannelID: 2, Tier: 3, InputPrice: 8, OutputPrice: 16, ContextLimit: 1000, PredictedSuccess: .99},
		},
		QualityThreshold: .90, MaxAttempts: 4, MaxEndpointsPerModel: 2, MaxCostMultiplier: 2.5,
	})
	require.NoError(t, err)
	require.Len(t, got.Nodes, 2)
	assert.Equal(t, "cheap", got.Nodes[0].Model)
	assert.Equal(t, "premium", got.Nodes[1].Model)
	assert.Equal(t, 2, got.PolicyVersion)
}

func TestPlanPrefersStickyRouteOnlyWithinFifteenPercentOfCheapest(t *testing.T) {
	base := PlanInput{
		RequestedModel: "client-model", PolicyVersion: 2,
		Features:         Features{Task: TaskGeneral, PromptTokens: 1_000, MaxOutputTokens: 100},
		Requirements:     Requirements{Capabilities: map[Capability]bool{}},
		QualityThreshold: .9, MaxAttempts: 3, MaxEndpointsPerModel: 2, MaxCostMultiplier: 2.5,
		Candidates: []Candidate{
			{Model: "cheapest", ChannelID: 1, InputPrice: 1, OutputPrice: 1, PredictedSuccess: .95},
			{Model: "sticky", ChannelID: 2, InputPrice: 1.1, OutputPrice: 1.1, PredictedSuccess: .94},
			{Model: "safest", ChannelID: 3, InputPrice: 5, OutputPrice: 5, PredictedSuccess: .99},
		},
		PreferredModel: "sticky", PreferredChannelID: 2,
	}
	plan, err := Plan(base)
	require.NoError(t, err)
	assert.Equal(t, "sticky", plan.Nodes[0].Model)

	base.Candidates[1].InputPrice, base.Candidates[1].OutputPrice = 1.2, 1.2
	plan, err = Plan(base)
	require.NoError(t, err)
	assert.Equal(t, "cheapest", plan.Nodes[0].Model)

	base.Candidates[1].InputPrice, base.Candidates[1].OutputPrice = 1.1, 1.1
	base.Candidates[1].HealthTier = HealthDegraded
	plan, err = Plan(base)
	require.NoError(t, err)
	assert.Equal(t, "cheapest", plan.Nodes[0].Model)
}

func TestPlanDoesNotMoveCheapestFirstNodeWhenSuccessProbabilitiesTie(t *testing.T) {
	plan, err := Plan(PlanInput{
		RequestedModel: "requested", Features: Features{PromptTokens: 100}, Requirements: Requirements{Capabilities: map[Capability]bool{}},
		QualityThreshold: .9, MaxAttempts: 3, MaxEndpointsPerModel: 2, MaxCostMultiplier: 2.5,
		Candidates: []Candidate{
			{Model: "cheap", ChannelID: 1, InputPrice: 1, PredictedSuccess: .95},
			{Model: "middle", ChannelID: 2, InputPrice: 2, PredictedSuccess: .95},
			{Model: "expensive", ChannelID: 3, InputPrice: 3, PredictedSuccess: .95},
		},
	})
	require.NoError(t, err)
	assert.Equal(t, "cheap", plan.Nodes[0].Model)
}

func TestPlanFiltersCapabilitiesAndContext(t *testing.T) {
	got, err := Plan(PlanInput{
		Requirements: Requirements{Capabilities: map[Capability]bool{CapabilityTools: true}, MinimumTier: 2, ContextNeeded: 900},
		Candidates: []Candidate{
			{Model: "no-tools", ChannelID: 1, Tier: 2, ContextLimit: 2000, PredictedSuccess: .99, InputPrice: 1},
			{Model: "too-small", ChannelID: 2, Tier: 2, ContextLimit: 1000, PredictedSuccess: .99, InputPrice: 1, Capabilities: map[Capability]bool{CapabilityTools: true}},
			{Model: "eligible", ChannelID: 3, Tier: 2, ContextLimit: 2000, PredictedSuccess: .95, InputPrice: 2, Capabilities: map[Capability]bool{CapabilityTools: true}},
		}, QualityThreshold: .90, MaxAttempts: 4, MaxEndpointsPerModel: 2, MaxCostMultiplier: 2.5,
	})
	require.NoError(t, err)
	require.Len(t, got.Nodes, 1)
	assert.Equal(t, "eligible", got.Nodes[0].Model)
}

func TestPlanFallsBackToHighestSuccessWhenNoneMeetThreshold(t *testing.T) {
	got, err := Plan(PlanInput{
		Requirements: Requirements{Capabilities: map[Capability]bool{}},
		Candidates: []Candidate{
			{Model: "cheap", ChannelID: 1, PredictedSuccess: .6, InputPrice: 1},
			{Model: "reliable", ChannelID: 2, PredictedSuccess: .8, InputPrice: 3},
		}, QualityThreshold: .9, MaxAttempts: 1, MaxEndpointsPerModel: 1, MaxCostMultiplier: 2.5,
	})
	require.NoError(t, err)
	require.Len(t, got.Nodes, 1)
	assert.Equal(t, "reliable", got.Nodes[0].Model)
}
