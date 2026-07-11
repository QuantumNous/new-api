package modelroute

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEmergencyRank(t *testing.T) {
	at := time.Unix(1_700_000_000, 0)
	expired := at.Add(-time.Second).Unix()
	almost := at.Add(1 * time.Second).Unix()
	later := at.Add(60 * time.Second).Unix()

	m1 := &model.ChannelModelMetrics{RouteState: string(model.RouteRateLimited), CooldownUntil: &expired}
	assert.Equal(t, 1, EmergencyRank(m1, at))

	m2 := &model.ChannelModelMetrics{RouteState: string(model.RouteUnknown)}
	assert.Equal(t, 2, EmergencyRank(m2, at))

	m3 := &model.ChannelModelMetrics{RouteState: string(model.RouteRateLimited), CooldownUntil: &almost}
	assert.Equal(t, 3, EmergencyRank(m3, at))

	m4 := &model.ChannelModelMetrics{RouteState: string(model.RouteOpen), LastErrorClass: string(model.ErrorTemporary)}
	assert.Equal(t, 4, EmergencyRank(m4, at))

	m5 := &model.ChannelModelMetrics{RouteState: string(model.RouteOpen), LastErrorClass: string(model.ErrorDeterministic)}
	assert.Equal(t, 100, EmergencyRank(m5, at))

	m6 := &model.ChannelModelMetrics{RouteState: string(model.RouteManuallyDisabled)}
	assert.Equal(t, 1000, EmergencyRank(m6, at))

	m7 := &model.ChannelModelMetrics{RouteState: string(model.RouteRateLimited), CooldownUntil: &later}
	assert.Equal(t, 50, EmergencyRank(m7, at))
}

func TestBuildEmergencyCandidatesExcludesDeterministic(t *testing.T) {
	all := []model.ResolvedRouteCandidate{
		{ChannelID: 1, ManualPriority: 10, Metrics: &model.ChannelModelMetrics{RouteState: string(model.RouteUnknown)}},
		{ChannelID: 2, ManualPriority: 20, Metrics: &model.ChannelModelMetrics{
			RouteState: string(model.RouteOpen), LastErrorClass: string(model.ErrorDeterministic),
		}},
		{ChannelID: 3, ManualPriority: 5, Metrics: &model.ChannelModelMetrics{
			RouteState: string(model.RouteOpen), LastErrorClass: string(model.ErrorTemporary),
		}},
	}
	ranked := BuildEmergencyCandidates(all, false)
	require.Len(t, ranked, 2)
	// unknown rank 2 before temporary open rank 4
	assert.Equal(t, int64(1), ranked[0].Candidate.ChannelID)
	assert.Equal(t, int64(3), ranked[1].Candidate.ChannelID)
}

func TestShouldEnterEmergency(t *testing.T) {
	GlobalConcurrency.Clear()
	assert.True(t, ShouldEnterEmergency(nil))

	healthy := []model.ResolvedRouteCandidate{
		{ChannelID: 1, EffectiveModel: "m", Metrics: &model.ChannelModelMetrics{
			ChannelID: 1, EffectiveModel: "m", RouteState: string(model.RouteHealthy),
		}},
	}
	assert.False(t, ShouldEnterEmergency(healthy))

	// healthy but no capacity
	mk := MakeMetricsKey(1, "m")
	GlobalConcurrency.SetLimit(mk, 1)
	s, _ := GlobalConcurrency.TryAcquireProductionSlot(mk)
	defer s.Release()
	assert.True(t, ShouldEnterEmergency(healthy))
}

func TestEmergencyLeaderSuccessAndWaiter(t *testing.T) {
	GlobalEmergency.Clear()
	GlobalRoles.Clear()
	GlobalMetricsRuntime.Clear()

	mBad := &model.ChannelModelMetrics{ChannelID: 1, EffectiveModel: "m", RouteState: string(model.RouteOpen), LastErrorClass: string(model.ErrorTemporary)}
	mGood := &model.ChannelModelMetrics{ChannelID: 2, EffectiveModel: "m", RouteState: string(model.RouteUnknown)}
	cands := []model.ResolvedRouteCandidate{
		{ChannelID: 1, EffectiveModel: "m", ManualPriority: 10, Metrics: mBad},
		{ChannelID: 2, EffectiveModel: "m", ManualPriority: 5, Metrics: mGood},
	}

	var tries atomic.Int32
	started := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	tryFn := func(ctx context.Context, c model.ResolvedRouteCandidate) BufferedAttemptResult {
		tries.Add(1)
		once.Do(func() { close(started) })
		// hold first attempt until waiter has joined
		select {
		case <-release:
		case <-ctx.Done():
		}
		// rank: UNKNOWN (ch2) before temporary OPEN (ch1) — leader should try ch2 first and succeed
		if c.ChannelID == 1 {
			return BufferedAttemptResult{Success: false, IsRetryableFailure: true, StatusCode: 503, Close: func() {}}
		}
		return BufferedAttemptResult{Success: true, StatusCode: 200, FirstChunk: []byte("ok")}
	}

	var wg sync.WaitGroup
	var leaderOut, waiterOut EmergencyOutcome
	wg.Add(1)
	go func() {
		defer wg.Done()
		leaderOut = GlobalEmergency.RunEmergency(context.Background(), "gpt-e", cands, tryFn, true)
	}()
	<-started
	wg.Add(1)
	go func() {
		defer wg.Done()
		waiterOut = GlobalEmergency.RunEmergency(context.Background(), "gpt-e", cands, tryFn, false)
	}()
	// give waiter time to park on flight
	time.Sleep(20 * time.Millisecond)
	close(release)
	wg.Wait()

	require.NoError(t, leaderOut.Err)
	require.NotNil(t, leaderOut.RecoveredCandidate)
	assert.Equal(t, int64(2), leaderOut.RecoveredCandidate.ChannelID)
	assert.False(t, leaderOut.WaiterOnly)
	require.NotNil(t, leaderOut.LeaderResult)
	assert.True(t, leaderOut.LeaderResult.Success)

	// only leader executes tries; UNKNOWN wins rank so single success try
	assert.Equal(t, int32(1), tries.Load())
	require.NoError(t, waiterOut.Err)
	assert.True(t, waiterOut.WaiterOnly)
	require.NotNil(t, waiterOut.RecoveredCandidate)
	assert.Equal(t, int64(2), waiterOut.RecoveredCandidate.ChannelID)
	assert.Nil(t, waiterOut.LeaderResult)
}

func TestEmergencyAllFail(t *testing.T) {
	GlobalEmergency.Clear()
	cands := []model.ResolvedRouteCandidate{
		{ChannelID: 1, EffectiveModel: "m", Metrics: &model.ChannelModelMetrics{RouteState: string(model.RouteUnknown)}},
	}
	out := GlobalEmergency.RunEmergency(context.Background(), "gpt-fail", cands, func(ctx context.Context, c model.ResolvedRouteCandidate) BufferedAttemptResult {
		return BufferedAttemptResult{Success: false, IsRetryableFailure: true, StatusCode: 500, Close: func() {}}
	}, true)
	assert.ErrorIs(t, out.Err, ErrEmergencyExhausted)
}
