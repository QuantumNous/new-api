package modelroute

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Integration: cold start → transparent retry → promote primary (PRD §11 + §30).
func TestIntegrationColdStartTransparentRetry(t *testing.T) {
	clearRouteTables(t)
	GlobalRoles.Clear()
	GlobalMetricsRuntime.Clear()
	GlobalConcurrency.Clear()

	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 1, RequestedModel: "gpt-cold", ManualPriority: 100, Enabled: true, Source: model.PolicySourceConfigured,
	}))
	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 2, RequestedModel: "gpt-cold", ManualPriority: 50, Enabled: true, Source: model.PolicySourceConfigured,
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 1, EffectiveModel: "gpt-cold", RouteState: string(model.RouteUnknown),
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 2, EffectiveModel: "gpt-cold", RouteState: string(model.RouteUnknown),
	}))

	list, cold, err := BuildTryListForRequest("gpt-cold")
	require.NoError(t, err)
	assert.True(t, cold)
	require.NotEmpty(t, list)
	// higher priority first
	assert.Equal(t, int64(1), list[0].ChannelID)
	assert.Equal(t, model.RoleBootstrap, GlobalRoles.Get(MakeMetricsKey(1, "gpt-cold")))

	// first fails pre-byte 503, second succeeds
	plan := TransparentRetryPlan{Candidates: list, ColdStart: true}
	idx, out, exhausted := RunTransparentRetry(plan, func(c model.ResolvedRouteCandidate, i int) AttemptOutcome {
		if c.ChannelID == 1 {
			return ClassifyAttempt(false, 503, false, false)
		}
		return ClassifyAttempt(true, 200, false, false)
	})
	assert.False(t, exhausted)
	assert.True(t, out.Success)
	assert.Equal(t, 1, idx)
	assert.Equal(t, model.RolePrimary, GlobalRoles.Get(MakeMetricsKey(list[idx].ChannelID, list[idx].EffectiveModel)))
}

// Integration: primary full → overflow lease → release (PRD §21–§22).
func TestIntegrationOverflowLeaseFlow(t *testing.T) {
	clearRouteTables(t)
	GlobalConcurrency.Clear()
	GlobalLeases.ClearAll()
	GlobalRoles.Clear()

	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 1, RequestedModel: "gpt-ov", ManualPriority: 100, Enabled: true, Source: model.PolicySourceConfigured,
	}))
	require.NoError(t, model.UpsertChannelModelPolicy(&model.ChannelModelPolicy{
		ChannelID: 2, RequestedModel: "gpt-ov", ManualPriority: 80, Enabled: true, Source: model.PolicySourceConfigured,
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 1, EffectiveModel: "gpt-ov", RouteState: string(model.RouteHealthy),
	}))
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 2, EffectiveModel: "gpt-ov", RouteState: string(model.RouteHealthy),
	}))

	pk := MakeMetricsKey(1, "gpt-ov")
	GlobalConcurrency.SetLimit(pk, 1)
	slot, ok := GlobalConcurrency.TryAcquireProductionSlot(pk)
	require.True(t, ok)

	chain, err := BuildProductionCandidateChainWithLease("gpt-ov")
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(chain), 2)
	assert.Equal(t, int64(1), chain[0].ChannelID)
	assert.Equal(t, int64(2), chain[1].ChannelID)
	assert.Equal(t, model.RoleOverflow, GlobalRoles.Get(MakeMetricsKey(2, "gpt-ov")))

	// overflow acquires its own slot
	ovSlot, ok := GlobalConcurrency.TryAcquireProductionSlot(MakeMetricsKey(2, "gpt-ov"))
	require.True(t, ok)
	ovSlot.Release()
	slot.Release()
	assert.Equal(t, 0, GlobalConcurrency.Active(pk))
}

// Integration: shadow probe success → RECOVERING (PRD §12 / §26).
func TestIntegrationShadowProbeRecover(t *testing.T) {
	clearRouteTables(t)
	GlobalProbeQueue.Clear()
	GlobalShadowTransport.Clear()
	GlobalMetricsRuntime.Clear()

	m := &model.ChannelModelMetrics{
		ChannelID: 3, EffectiveModel: "eff", RouteState: string(model.RouteProbing),
	}
	require.NoError(t, model.UpsertChannelModelMetrics(m))
	GlobalMetricsRuntime.Put(m)
	GlobalProbeQueue.Upsert(model.ProbeQueueItem{
		MetricsKey: m.MetricsKey(), NextProbeAt: time.Now().Add(-time.Second),
	})

	d := &ShadowDispatcher{
		Builder: TextShadowBuilder{},
		Executor: func(ctx context.Context, req *ShadowRequest) ShadowResult {
			return ShadowResult{TransportOK: true, TTFT: 15 * time.Millisecond, BuildResult: ShadowBuildOK}
		},
	}
	prod := &ProductionRequestView{Messages: []ShadowMessage{{Role: "user", Text: "ping"}}}
	d.MaybeDispatchShadowProbeAsync(prod, "req", "r1", model.MetricsKey{})

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if m.State() == model.RouteRecovering || m.State() == model.RouteHealthy {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	assert.Contains(t, []model.RouteState{model.RouteRecovering, model.RouteHealthy}, m.State())
}

// Integration: emergency leader/waiter (PRD §28).
func TestIntegrationEmergencyLeaderWaiter(t *testing.T) {
	GlobalEmergency.Clear()
	GlobalRoles.Clear()
	mGood := &model.ChannelModelMetrics{ChannelID: 9, EffectiveModel: "m", RouteState: string(model.RouteUnknown)}
	cands := []model.ResolvedRouteCandidate{
		{ChannelID: 9, EffectiveModel: "m", RequestedModel: "gpt-em", Metrics: mGood},
	}
	started := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	tryFn := func(ctx context.Context, c model.ResolvedRouteCandidate) BufferedAttemptResult {
		once.Do(func() { close(started) })
		select {
		case <-release:
		case <-ctx.Done():
		}
		return BufferedAttemptResult{Success: true, StatusCode: 200, FirstChunk: []byte("x")}
	}
	var leader, waiter EmergencyOutcome
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		leader = GlobalEmergency.RunEmergency(context.Background(), "gpt-em", cands, tryFn, true)
	}()
	<-started
	wg.Add(1)
	go func() {
		defer wg.Done()
		waiter = GlobalEmergency.RunEmergency(context.Background(), "gpt-em", cands, tryFn, false)
	}()
	time.Sleep(15 * time.Millisecond)
	close(release)
	wg.Wait()
	require.NoError(t, leader.Err)
	require.NoError(t, waiter.Err)
	assert.False(t, leader.WaiterOnly)
	assert.True(t, waiter.WaiterOnly)
	assert.Equal(t, int64(9), leader.RecoveredCandidate.ChannelID)
}

// CanTakeOver three-zone rules (PRD §27).
func TestCanTakeOverZones(t *testing.T) {
	// higher priority: only need not significantly worse
	curScore := 0.5
	candScore := 0.48
	curTTFT := 1000.0
	candTTFT := 1100.0 // within 1.15x
	nowTs := time.Now().Unix()
	cur := model.ResolvedRouteCandidate{
		ManualPriority: 50,
		Metrics: &model.ChannelModelMetrics{
			RouteState: string(model.RouteHealthy), ProductionSuccessEMA: floatPtr(0.9),
			ProductionTTFTEMAMs: &curTTFT, ExperienceScore: &curScore,
			LastSuccessAt: &nowTs,
		},
	}
	cand := model.ResolvedRouteCandidate{
		ManualPriority: 100,
		Metrics: &model.ChannelModelMetrics{
			RouteState: string(model.RouteHealthy), ProductionSuccessEMA: floatPtr(0.9),
			ProductionTTFTEMAMs: &candTTFT, ExperienceScore: &candScore,
			TakeoverConfirmations: 3, LastSuccessAt: &nowTs,
		},
	}
	assert.True(t, CanTakeOver(cur, cand))

	// same priority: need clear advantage
	cand.ManualPriority = 50
	candTTFT2 := 800.0 // better than 1000/1.10≈909
	cand.Metrics.ProductionTTFTEMAMs = &candTTFT2
	assert.True(t, CanTakeOver(cur, cand))

	// lower priority: high bar
	cand.ManualPriority = 0
	cand.Metrics.TakeoverConfirmations = 3
	assert.False(t, CanTakeOver(cur, cand)) // not enough confirmations / gain
	cand.Metrics.TakeoverConfirmations = 8
	candTTFT3 := 200.0
	cand.Metrics.ProductionTTFTEMAMs = &candTTFT3
	assert.True(t, CanTakeOver(cur, cand))
}

func floatPtr(v float64) *float64 { return &v }

func BenchmarkBuildProductionCandidateChain(b *testing.B) {
	// in-memory plan path
	InvalidateAllRoutePlans()
	plan := &model.RoutePlan{
		RequestedModel: "bench",
		Primary:        &model.ResolvedRouteCandidate{ChannelID: 1, ManualPriority: 100},
	}
	for i := 0; i < 20; i++ {
		cp := model.ResolvedRouteCandidate{ChannelID: int64(i + 2), ManualPriority: 50 - i}
		plan.OverflowChain = append(plan.OverflowChain, &cp)
	}
	StoreRoutePlan(plan)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = BuildProductionCandidateChain("bench")
	}
}
