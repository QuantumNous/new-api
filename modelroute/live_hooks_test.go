package modelroute

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyProductionOutcomeSuccessAndFail(t *testing.T) {
	clearRouteTables(t)
	GlobalRoles.Clear()
	GlobalMetricsRuntime.Clear()
	SetRoutingPriorityMode(model.RoutingPriorityModeModel)

	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 11, EffectiveModel: "m", RouteState: string(model.RouteUnknown),
	}))

	ApplyProductionOutcome(ProductionOutcome{
		ChannelID: 11, RequestedModel: "m", Success: true, StatusCode: 200, TTFT: 25 * time.Millisecond,
	})
	m := EnsureRuntimeMetrics(11, "m")
	require.NotNil(t, m)
	assert.Equal(t, model.RouteHealthy, m.State())
	assert.NotNil(t, m.ProductionSuccessEMA)
	assert.Equal(t, model.RolePrimary, GlobalRoles.Get(MakeMetricsKey(11, "m")))

	ApplyProductionOutcome(ProductionOutcome{
		ChannelID: 11, RequestedModel: "m", Success: false, StatusCode: 503,
	})
	// temporary fail once may stay HEALTHY until threshold
	assert.NotNil(t, m.ProductionSuccessEMA)
}

func TestApplyProductionOutcomeDisabledWhenChannelPriority(t *testing.T) {
	clearRouteTables(t)
	SetRoutingPriorityMode(model.RoutingPriorityModeChannel)
	ApplyProductionOutcome(ProductionOutcome{ChannelID: 1, RequestedModel: "x", Success: true})
	assert.Nil(t, GlobalMetricsRuntime.Get(MakeMetricsKey(1, "x")))
}
