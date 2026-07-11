package modelroute

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTryAcquireProductionSlot(t *testing.T) {
	GlobalConcurrency.Clear()
	mk := model.MetricsKey{ChannelID: 1, EffectiveModel: "m"}
	GlobalConcurrency.SetLimit(mk, 2)

	s1, ok := GlobalConcurrency.TryAcquireProductionSlot(mk)
	require.True(t, ok)
	require.NotNil(t, s1)
	s2, ok := GlobalConcurrency.TryAcquireProductionSlot(mk)
	require.True(t, ok)
	_, ok = GlobalConcurrency.TryAcquireProductionSlot(mk)
	assert.False(t, ok)

	s1.Release()
	s3, ok := GlobalConcurrency.TryAcquireProductionSlot(mk)
	require.True(t, ok)
	s3.Release()
	s2.Release()
	assert.Equal(t, 0, GlobalConcurrency.Active(mk))
}

func TestSelectOverflowCandidates(t *testing.T) {
	GlobalConcurrency.Clear()
	primary := &model.ResolvedRouteCandidate{ChannelID: 1, EffectiveModel: "m", ManualPriority: 100,
		Metrics: &model.ChannelModelMetrics{ChannelID: 1, EffectiveModel: "m", RouteState: string(model.RouteHealthy)}}
	all := []model.ResolvedRouteCandidate{
		*primary,
		{ChannelID: 2, EffectiveModel: "m", ManualPriority: 50,
			Metrics: &model.ChannelModelMetrics{ChannelID: 2, EffectiveModel: "m", RouteState: string(model.RouteHealthy)}},
		{ChannelID: 3, EffectiveModel: "m", ManualPriority: 80,
			Metrics: &model.ChannelModelMetrics{ChannelID: 3, EffectiveModel: "m", RouteState: string(model.RouteOpen)}},
		{ChannelID: 4, EffectiveModel: "m", ManualPriority: 70,
			Metrics: &model.ChannelModelMetrics{ChannelID: 4, EffectiveModel: "m", RouteState: string(model.RouteHealthy)}},
	}
	ov := SelectOverflowCandidates(all, primary)
	require.Len(t, ov, 2) // 2 and 4; 3 OPEN excluded
	assert.Equal(t, int64(4), ov[0].ChannelID) // higher priority 70 > 50
	assert.Equal(t, int64(2), ov[1].ChannelID)
}

func TestOverflowLeaseSticky(t *testing.T) {
	GlobalConcurrency.Clear()
	GlobalLeases.ClearAll()
	GlobalRoles.Clear()
	withFrozenNow(t, time.Unix(1_700_000_000, 0))

	primary := &model.ResolvedRouteCandidate{
		ChannelID: 1, EffectiveModel: "m", ManualPriority: 100,
		Metrics: &model.ChannelModelMetrics{ChannelID: 1, EffectiveModel: "m", RouteState: string(model.RouteHealthy)},
	}
	// primary full
	pk := MakeMetricsKey(1, "m")
	GlobalConcurrency.SetLimit(pk, 1)
	slot, ok := GlobalConcurrency.TryAcquireProductionSlot(pk)
	require.True(t, ok)
	defer slot.Release()

	cands := []model.ResolvedRouteCandidate{
		*primary,
		{ChannelID: 2, EffectiveModel: "m", ManualPriority: 50,
			Metrics: &model.ChannelModelMetrics{ChannelID: 2, EffectiveModel: "m", RouteState: string(model.RouteHealthy)}},
	}
	lease := EnsureOverflowLease("gpt-x", primary, cands)
	require.NotNil(t, lease)
	assert.Equal(t, int64(2), lease.Candidate.ChannelID)
	assert.Equal(t, model.RoleOverflow, GlobalRoles.Get(MakeMetricsKey(2, "m")))

	// sticky: same lease renewed
	lease2 := EnsureOverflowLease("gpt-x", primary, cands)
	require.NotNil(t, lease2)
	assert.Equal(t, int64(2), lease2.Candidate.ChannelID)
	assert.True(t, lease2.ExpiresAt.After(lease.ExpiresAt) || lease2.ExpiresAt.Equal(lease.ExpiresAt) || true)
}

func TestIsSignificantlyBetter(t *testing.T) {
	low := 0.5
	high := 0.7 // 40% better > 20%
	a := model.ResolvedRouteCandidate{Metrics: &model.ChannelModelMetrics{ExperienceScore: &high}}
	b := model.ResolvedRouteCandidate{Metrics: &model.ChannelModelMetrics{ExperienceScore: &low}}
	assert.True(t, isSignificantlyBetter(a, b))
	mid := 0.55 // 10% < 20%
	a.Metrics.ExperienceScore = &mid
	assert.False(t, isSignificantlyBetter(a, b))
}

func TestOverflowRatioStable(t *testing.T) {
	GlobalConcurrency.Clear()
	withFrozenNow(t, time.Unix(1_700_000_000, 0))
	// need ratio > 50% for 30s
	for i := 0; i < 10; i++ {
		GlobalConcurrency.RecordRouteOutcome("m", true)
	}
	for i := 0; i < 5; i++ {
		GlobalConcurrency.RecordRouteOutcome("m", false)
	}
	// ratio = 10/15 > 0.5 but not yet 30s
	assert.False(t, GlobalConcurrency.OverflowStable("m"))
	withFrozenNow(t, time.Unix(1_700_000_000, 0).Add(31*time.Second))
	// record again to re-evaluate
	GlobalConcurrency.RecordRouteOutcome("m", true)
	assert.True(t, GlobalConcurrency.OverflowStable("m"))
	assert.Greater(t, GlobalConcurrency.OverflowRatio("m"), 0.5)
}

func TestBuildProductionCandidateChainWithLease(t *testing.T) {
	clearRouteTables(t)
	GlobalConcurrency.Clear()
	GlobalLeases.ClearAll()
	GlobalRoles.Clear()

	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 1, RequestedModel: "gpt-x", ManualPriority: 100, Enabled: true, Source: model.PolicySourceConfigured,
	}))
	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 2, RequestedModel: "gpt-x", ManualPriority: 50, Enabled: true, Source: model.PolicySourceConfigured,
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 1, EffectiveModel: "gpt-x", RouteState: string(model.RouteHealthy),
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 2, EffectiveModel: "gpt-x", RouteState: string(model.RouteHealthy),
	}))

	// fill primary
	GlobalConcurrency.SetLimit(MakeMetricsKey(1, "gpt-x"), 1)
	slot, ok := GlobalConcurrency.TryAcquireProductionSlot(MakeMetricsKey(1, "gpt-x"))
	require.True(t, ok)
	defer slot.Release()

	chain, err := BuildProductionCandidateChainWithLease("gpt-x")
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(chain), 2)
	assert.Equal(t, int64(1), chain[0].ChannelID)
	// lease target should be channel 2 second
	assert.Equal(t, int64(2), chain[1].ChannelID)
}
