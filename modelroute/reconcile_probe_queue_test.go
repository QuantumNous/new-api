package modelroute

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReconcileProbeQueueFromDB(t *testing.T) {
	clearRouteTables(t)
	GlobalProbeQueue.Clear()
	base := time.Unix(1_800_000_000, 0)
	previousNow := now
	now = func() time.Time { return base }
	t.Cleanup(func() {
		now = previousNow
		GlobalProbeQueue.Clear()
		SetRoutingPriorityMode(model.RoutingPriorityModeChannel)
	})

	openCooldown := base.Add(20 * time.Second).Unix()
	rateLimitedCooldown := base.Add(10 * time.Second).Unix()
	rows := []model.ChannelModelMetrics{
		{ChannelID: 101, EffectiveModel: "probing", RouteState: string(model.RouteProbing)},
		{ChannelID: 102, EffectiveModel: "open", RouteState: string(model.RouteOpen), CooldownUntil: &openCooldown},
		{ChannelID: 103, EffectiveModel: "rate-limited", RouteState: string(model.RouteRateLimited), CooldownUntil: &rateLimitedCooldown},
		{ChannelID: 104, EffectiveModel: "healthy", RouteState: string(model.RouteHealthy)},
	}
	for i := range rows {
		require.NoError(t, model.UpsertChannelModelMetrics(&rows[i]))
	}

	SetRoutingPriorityMode(model.RoutingPriorityModeModel)
	require.NoError(t, ReconcileProbeQueueFromDB())
	assert.Equal(t, 3, GlobalProbeQueue.Len())
	require.NoError(t, ReconcileProbeQueueFromDB())
	assert.Equal(t, 3, GlobalProbeQueue.Len())

	want := []model.MetricsKey{
		{ChannelID: 101, EffectiveModel: "probing"},
		{ChannelID: 103, EffectiveModel: "rate-limited"},
		{ChannelID: 102, EffectiveModel: "open"},
	}
	for _, key := range want {
		item, ok := GlobalProbeQueue.PopForced()
		require.True(t, ok)
		assert.Equal(t, key, item.MetricsKey)
		assert.Zero(t, item.ManualPriority)
	}
	assert.Zero(t, GlobalProbeQueue.Len())

	SetRoutingPriorityMode(model.RoutingPriorityModeChannel)
	require.NoError(t, ReconcileProbeQueueFromDB())
	assert.Zero(t, GlobalProbeQueue.Len())
}
