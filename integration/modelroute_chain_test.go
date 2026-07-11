package integration

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/modelroute"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestMain(m *testing.M) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		panic(err)
	}
	model.DB = db
	model.LOG_DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.MemoryCacheEnabled = false
	sqlDB, err := db.DB()
	if err != nil {
		panic(err)
	}
	sqlDB.SetMaxOpenConns(1)
	if err := db.AutoMigrate(
		&model.Channel{},
		&model.Option{},
		&model.ChannelModelPolicy{},
		&model.ChannelModelMetrics{},
	); err != nil {
		panic(err)
	}
	m.Run()
}

func clearAll(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.Exec("DELETE FROM channel_model_policy").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM channel_model_metrics").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM channels").Error)
	modelroute.InvalidateAllRoutePlans()
	modelroute.SetRoutingPriorityMode(model.RoutingPriorityModeModel)
	modelroute.GlobalRoles.Clear()
	modelroute.GlobalMetricsRuntime.Clear()
	modelroute.GlobalConcurrency.Clear()
	modelroute.GlobalLeases.ClearAll()
	modelroute.GlobalProbeQueue.Clear()
	modelroute.GlobalShadowTransport.Clear()
	modelroute.GlobalEmergency.Clear()
	modelroute.MappingProvider = func(channelID int64) (string, error) { return "", nil }
}

// Cold start → transparent retry → promote primary.
func TestChainColdStartTransparentRetry(t *testing.T) {
	clearAll(t)
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

	list, cold, err := modelroute.BuildTryListForRequest("gpt-cold")
	require.NoError(t, err)
	assert.True(t, cold)
	require.NotEmpty(t, list)

	plan := modelroute.TransparentRetryPlan{Candidates: list, ColdStart: true}
	idx, out, exhausted := modelroute.RunTransparentRetry(plan, func(c model.ResolvedRouteCandidate, i int) modelroute.AttemptOutcome {
		if c.ChannelID == 1 {
			return modelroute.ClassifyAttempt(false, 503, false, false)
		}
		return modelroute.ClassifyAttempt(true, 200, false, false)
	})
	assert.False(t, exhausted)
	assert.True(t, out.Success)
	assert.Equal(t, 1, idx)
	assert.Equal(t, model.RolePrimary, modelroute.GlobalRoles.Get(modelroute.MakeMetricsKey(list[idx].ChannelID, list[idx].EffectiveModel)))
}

// Primary full → overflow lease.
func TestChainOverflowLease(t *testing.T) {
	clearAll(t)
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
	pk := modelroute.MakeMetricsKey(1, "gpt-ov")
	modelroute.GlobalConcurrency.SetLimit(pk, 1)
	slot, ok := modelroute.GlobalConcurrency.TryAcquireProductionSlot(pk)
	require.True(t, ok)
	chain, err := modelroute.BuildProductionCandidateChainWithLease("gpt-ov")
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(chain), 2)
	assert.Equal(t, int64(1), chain[0].ChannelID)
	assert.Equal(t, int64(2), chain[1].ChannelID)
	slot.Release()
}

// Shadow probe success → RECOVERING/HEALTHY.
func TestChainShadowProbeRecover(t *testing.T) {
	clearAll(t)
	m := &model.ChannelModelMetrics{
		ChannelID: 3, EffectiveModel: "eff", RouteState: string(model.RouteProbing),
	}
	require.NoError(t, model.UpsertChannelModelMetrics(m))
	modelroute.GlobalMetricsRuntime.Put(m)
	modelroute.GlobalProbeQueue.Upsert(model.ProbeQueueItem{
		MetricsKey: m.MetricsKey(), NextProbeAt: time.Now().Add(-time.Second),
	})
	d := &modelroute.ShadowDispatcher{
		Builder: modelroute.TextShadowBuilder{},
		Executor: func(ctx context.Context, req *modelroute.ShadowRequest) modelroute.ShadowResult {
			return modelroute.ShadowResult{TransportOK: true, TTFT: 15 * time.Millisecond, BuildResult: modelroute.ShadowBuildOK}
		},
	}
	prod := &modelroute.ProductionRequestView{Messages: []modelroute.ShadowMessage{{Role: "user", Text: "ping"}}}
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

// Emergency Leader/Waiter.
func TestChainEmergencyLeaderWaiter(t *testing.T) {
	clearAll(t)
	mGood := &model.ChannelModelMetrics{ChannelID: 9, EffectiveModel: "m", RouteState: string(model.RouteUnknown)}
	cands := []model.ResolvedRouteCandidate{
		{ChannelID: 9, EffectiveModel: "m", RequestedModel: "gpt-em", Metrics: mGood},
	}
	started := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	tryFn := func(ctx context.Context, c model.ResolvedRouteCandidate) modelroute.BufferedAttemptResult {
		once.Do(func() { close(started) })
		select {
		case <-release:
		case <-ctx.Done():
		}
		return modelroute.BufferedAttemptResult{Success: true, StatusCode: 200, FirstChunk: []byte("x")}
	}
	var leader, waiter modelroute.EmergencyOutcome
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		leader = modelroute.GlobalEmergency.RunEmergency(context.Background(), "gpt-em", cands, tryFn, true)
	}()
	<-started
	wg.Add(1)
	go func() {
		defer wg.Done()
		waiter = modelroute.GlobalEmergency.RunEmergency(context.Background(), "gpt-em", cands, tryFn, false)
	}()
	time.Sleep(15 * time.Millisecond)
	close(release)
	wg.Wait()
	require.NoError(t, leader.Err)
	require.NoError(t, waiter.Err)
	assert.False(t, leader.WaiterOnly)
	assert.True(t, waiter.WaiterOnly)
}

// Live production outcome hook updates metrics.
func TestLiveProductionOutcomeHook(t *testing.T) {
	clearAll(t)
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 7, EffectiveModel: "gpt-live", RouteState: string(model.RouteUnknown),
	}))
	modelroute.ApplyProductionOutcome(modelroute.ProductionOutcome{
		ChannelID: 7, RequestedModel: "gpt-live", Success: true, StatusCode: 200, TTFT: 40 * time.Millisecond,
	})
	m := modelroute.EnsureRuntimeMetrics(7, "gpt-live")
	require.NotNil(t, m)
	assert.Equal(t, model.RouteHealthy, m.State())
	assert.Equal(t, model.RolePrimary, modelroute.GlobalRoles.Get(modelroute.MakeMetricsKey(7, "gpt-live")))
}
