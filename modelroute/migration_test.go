package modelroute

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMigrateToModelPriority(t *testing.T) {
	clearRouteTables(t)
	InvalidateAllRoutePlans()
	SetRoutingPriorityMode(model.RoutingPriorityModeChannel)

	pri := int64(42)
	w := uint(10)
	mapping := `{"gpt-a":"eff-a"}`
	ch := &model.Channel{
		Id: 11, Models: "gpt-a,gpt-b", ModelMapping: &mapping,
		Priority: &pri, Weight: &w, Status: common.ChannelStatusEnabled,
		Key: "k", Name: "c11",
	}
	require.NoError(t, model.DB.Create(ch).Error)

	res, err := MigrateToModelPriority()
	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Greater(t, res.PoliciesTouched, 0)
	assert.Greater(t, res.MetricsTouched, 0)
	assert.Equal(t, 1, res.ChannelsZeroed)
	assert.True(t, IsModelPriorityMode())

	// channel zeroed
	got, err := model.GetChannelById(11, true)
	require.NoError(t, err)
	assert.Equal(t, int64(0), got.GetPriority())
	assert.Equal(t, 0, got.GetWeight())

	// policy has initial manual_priority from old channel priority
	pol, err := model.GetChannelModelPolicy(11, "gpt-a")
	require.NoError(t, err)
	require.NotNil(t, pol)
	assert.Equal(t, 42, pol.ManualPriority)

	met, err := model.GetChannelModelMetrics(11, "eff-a")
	require.NoError(t, err)
	require.NotNil(t, met)
}

func TestResetLearningHelpers(t *testing.T) {
	clearRouteTables(t)
	require.NoError(t, model.UpsertChannelModelMetrics(&model.ChannelModelMetrics{
		ChannelID: 1, EffectiveModel: "m", RouteState: string(model.RouteHealthy),
		ShadowCalibrationJSON: `{"0-1k":{"ratio":1.2,"sample_count":1}}`,
	}))
	succ := 0.9
	m, _ := model.GetChannelModelMetrics(1, "m")
	require.NotNil(t, m)
	m.ProductionSuccessEMA = &succ
	require.NoError(t, model.UpsertChannelModelMetrics(m))

	n, err := ResetRuntimeLearning(1, "m")
	require.NoError(t, err)
	assert.Equal(t, 1, n)
	after, _ := model.GetChannelModelMetrics(1, "m")
	require.NotNil(t, after)
	assert.Nil(t, after.ProductionSuccessEMA)
	assert.NotEmpty(t, after.ShadowCalibrationJSON)

	n, err = ResetAllLearning(1, "m")
	require.NoError(t, err)
	assert.Equal(t, 1, n)
	after, _ = model.GetChannelModelMetrics(1, "m")
	require.NotNil(t, after)
	assert.Empty(t, after.ShadowCalibrationJSON)
}
