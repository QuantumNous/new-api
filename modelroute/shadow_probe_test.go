package modelroute

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTextShadowBuilder(t *testing.T) {
	b := TextShadowBuilder{}
	prod := &ProductionRequestView{
		Messages: []ShadowMessage{
			{Role: "system", Text: "sys"},
			{Role: "user", Text: "hello"},
		},
	}
	req, res := b.BuildShadowRequest(prod, 1, "gpt", "gpt-eff")
	require.Equal(t, ShadowBuildOK, res)
	require.NotNil(t, req)
	assert.Equal(t, model.DefaultShadowProbeMaxTokens, req.MaxTokens)
	require.Len(t, req.Messages, 2)
	assert.Equal(t, "user", req.Messages[1].Role)
	assert.Equal(t, "hello", req.Messages[1].Text)
}

func TestTextShadowBuilderUnprobeable(t *testing.T) {
	b := TextShadowBuilder{}
	_, res := b.BuildShadowRequest(&ProductionRequestView{
		HasNonTextContent:       true,
		TextIndependentComplete: false,
		Messages:                []ShadowMessage{{Role: "user", Text: "x"}},
	}, 1, "m", "m")
	assert.Equal(t, ShadowUnprobeableContent, res)

	_, res = b.BuildShadowRequest(&ProductionRequestView{
		Messages: []ShadowMessage{{Role: "system", Text: "only sys"}},
	}, 1, "m", "m")
	assert.Equal(t, ShadowUnprobeableContent, res)
}

func TestMultimodalShadowBuilder(t *testing.T) {
	b := MultimodalShadowBuilder{}
	prod := &ProductionRequestView{
		HasNonTextContent:       true,
		TextIndependentComplete: true,
		Messages:                []ShadowMessage{{Role: "user", Text: "describe"}},
	}
	req, res := b.BuildShadowRequest(prod, 1, "m", "m")
	require.Equal(t, ShadowBuildOK, res)
	require.NotNil(t, req)
	assert.False(t, req.MultimodalKept)

	prod.TextIndependentComplete = false
	prod.ProviderSupportsSafeMultimodal = true
	req, res = b.BuildShadowRequest(prod, 1, "m", "m")
	require.Equal(t, ShadowBuildOK, res)
	assert.True(t, req.MultimodalKept)

	prod.ProviderSupportsSafeMultimodal = false
	_, res = b.BuildShadowRequest(prod, 1, "m", "m")
	assert.Equal(t, ShadowUnprobeableContent, res)
}

func TestShadowFailureWeight(t *testing.T) {
	assert.Equal(t, 0.0, ShadowFailureWeight(ShadowUnprobeableContent))
	assert.Equal(t, 0.0, ShadowFailureWeight(ShadowTemplateIncompatible))
	assert.Equal(t, 0.35, ShadowFailureWeight(ShadowTransportFailure))
	assert.Equal(t, 1.0, ProductionFailureWeight(true))
	assert.Equal(t, 0.85, ProductionFailureWeight(false))
}

func TestProbeQueueOrder(t *testing.T) {
	q := NewProbeQueue()
	base := time.Unix(1_700_000_000, 0)
	q.Upsert(model.ProbeQueueItem{
		MetricsKey: model.MetricsKey{ChannelID: 1, EffectiveModel: "a"},
		NextProbeAt: base.Add(10 * time.Second), ManualPriority: 100,
	})
	q.Upsert(model.ProbeQueueItem{
		MetricsKey: model.MetricsKey{ChannelID: 2, EffectiveModel: "b"},
		NextProbeAt: base, ManualPriority: 10,
	})
	q.Upsert(model.ProbeQueueItem{
		MetricsKey: model.MetricsKey{ChannelID: 3, EffectiveModel: "c"},
		NextProbeAt: base, ManualPriority: 50,
	})
	// due at base: higher manual_priority first among same next_probe_at
	item, ok := q.PopDue(base)
	require.True(t, ok)
	assert.Equal(t, int64(3), item.MetricsKey.ChannelID)

	item, ok = q.PopDue(base)
	require.True(t, ok)
	assert.Equal(t, int64(2), item.MetricsKey.ChannelID)

	// not yet due
	_, ok = q.PopDue(base)
	assert.False(t, ok)
	item, ok = q.PopDue(base.Add(10 * time.Second))
	require.True(t, ok)
	assert.Equal(t, int64(1), item.MetricsKey.ChannelID)
}

func TestAllowsOpenOnShadowTransport(t *testing.T) {
	assert.False(t, AllowsOpenOnShadowTransport(2, 2))
	assert.False(t, AllowsOpenOnShadowTransport(3, 1))
	assert.True(t, AllowsOpenOnShadowTransport(3, 2))
}

func TestShadowDispatcherAsyncNoBlock(t *testing.T) {
	GlobalProbeQueue.Clear()
	GlobalShadowTransport.Clear()
	GlobalMetricsRuntime.Clear()
	withFrozenNow(t, time.Unix(1_700_000_000, 0))

	m := &model.ChannelModelMetrics{
		ChannelID: 9, EffectiveModel: "eff", RouteState: string(model.RouteProbing),
	}
	GlobalMetricsRuntime.Put(m)
	GlobalProbeQueue.Upsert(model.ProbeQueueItem{
		MetricsKey:  m.MetricsKey(),
		NextProbeAt: now().Add(-time.Second),
	})

	var ran atomic.Int32
	d := &ShadowDispatcher{
		Builder: TextShadowBuilder{},
		Executor: func(ctx context.Context, req *ShadowRequest) ShadowResult {
			ran.Add(1)
			return ShadowResult{TransportOK: true, TTFT: 20 * time.Millisecond, BuildResult: ShadowBuildOK}
		},
	}
	prod := &ProductionRequestView{Messages: []ShadowMessage{{Role: "user", Text: "hi"}}}
	// must return immediately
	start := time.Now()
	d.MaybeDispatchShadowProbeAsync(prod, "req", "rid-1", model.MetricsKey{})
	assert.Less(t, time.Since(start), 50*time.Millisecond)

	// wait for async
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) && ran.Load() == 0 {
		time.Sleep(5 * time.Millisecond)
	}
	assert.Equal(t, int32(1), ran.Load())
	// eventually recovering/healthy
	deadline = time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		st := m.State()
		if st == model.RouteRecovering || st == model.RouteHealthy {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	assert.Contains(t, []model.RouteState{model.RouteRecovering, model.RouteHealthy}, m.State())
}
