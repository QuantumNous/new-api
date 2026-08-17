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
