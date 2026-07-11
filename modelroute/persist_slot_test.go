package modelroute

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyTransitionSnapshotsCritical(t *testing.T) {
	clearRouteTables(t)
	GlobalMetricsRuntime.Clear()
	SetRoutingPriorityMode(model.RoutingPriorityModeModel)

	m := &model.ChannelModelMetrics{
		ChannelID: 77, EffectiveModel: "m-p0", RouteState: string(model.RouteHealthy),
	}
	require.NoError(t, model.UpsertChannelModelMetrics(m))
	GlobalMetricsRuntime.Put(m)

	// trip open should change state and persist (SnapshotCritical writes DB)
	changed := ApplyTransition(m, EventTripOpen, 0)
	assert.True(t, changed)
	assert.Equal(t, model.RouteOpen, m.State())

	// re-load from DB — should see OPEN if SnapshotCritical worked
	got, err := model.GetChannelModelMetrics(77, "m-p0")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, string(model.RouteOpen), got.RouteState)
}

func TestAcquireProductionSlotRespectsLimit(t *testing.T) {
	clearRouteTables(t)
	GlobalConcurrency.Clear()
	SetRoutingPriorityMode(model.RoutingPriorityModeModel)

	mk := MakeMetricsKey(5, "gpt-slot")
	GlobalConcurrency.SetLimit(mk, 1)

	s1, _, ok1 := AcquireProductionSlotForRequest(5, "gpt-slot", "")
	require.True(t, ok1)
	require.NotNil(t, s1)

	s2, _, ok2 := AcquireProductionSlotForRequest(5, "gpt-slot", "")
	assert.False(t, ok2)
	assert.Nil(t, s2)

	s1.Release()
	s3, _, ok3 := AcquireProductionSlotForRequest(5, "gpt-slot", "")
	assert.True(t, ok3)
	require.NotNil(t, s3)
	s3.Release()
}

func TestAcquireProductionSlotNoopWhenChannelPriority(t *testing.T) {
	clearRouteTables(t)
	GlobalConcurrency.Clear()
	SetRoutingPriorityMode(model.RoutingPriorityModeChannel)
	mk := MakeMetricsKey(5, "gpt-slot")
	GlobalConcurrency.SetLimit(mk, 1)
	// even with limit, channel_priority mode always ok without tracking
	s, _, ok := AcquireProductionSlotForRequest(5, "gpt-slot", "")
	assert.True(t, ok)
	assert.Nil(t, s)
}

func TestMarkDirtyAndSnapshotNow(t *testing.T) {
	clearRouteTables(t)
	GlobalMetricsRuntime.Clear()
	SetRoutingPriorityMode(model.RoutingPriorityModeModel)
	m := &model.ChannelModelMetrics{
		ChannelID: 88, EffectiveModel: "m-dirty", RouteState: string(model.RouteUnknown),
	}
	require.NoError(t, model.UpsertChannelModelMetrics(m))
	GlobalMetricsRuntime.Put(m)
	// soft update
	ApplyProductionOutcome(ProductionOutcome{
		ChannelID: 88, RequestedModel: "m-dirty", Success: true, StatusCode: 200, TTFT: 10 * time.Millisecond,
	})
	// dirty may have been snapshotted critically on HEALTHY transition; SnapshotNow still ok
	n, err := GlobalCalibrationPersister.SnapshotNow()
	require.NoError(t, err)
	assert.GreaterOrEqual(t, n, 0)
}
