package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelModelPolicyCRUD(t *testing.T) {
	truncateTables(t)

	p := &ChannelModelPolicy{
		ChannelID:      12,
		RequestedModel: "gpt-5.6",
		ManualPriority: 100,
		Enabled:        true,
		Source:         PolicySourceConfigured,
	}
	require.NoError(t, UpsertChannelModelPolicy(p))

	got, err := GetChannelModelPolicy(12, "gpt-5.6")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, 100, got.ManualPriority)
	assert.True(t, got.Enabled)
	assert.Equal(t, PolicySourceConfigured, got.Source)
	assert.Greater(t, got.CreatedAt, int64(0))
	assert.Greater(t, got.UpdatedAt, int64(0))

	require.NoError(t, UpdateChannelModelPolicyManualPriority(12, "gpt-5.6", 60))
	got, err = GetChannelModelPolicy(12, "gpt-5.6")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, 60, got.ManualPriority)

	require.NoError(t, UpdateChannelModelPolicyEnabled(12, "gpt-5.6", false))
	got, err = GetChannelModelPolicy(12, "gpt-5.6")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.False(t, got.Enabled)

	// upsert updates on conflict
	require.NoError(t, UpsertChannelModelPolicy(&ChannelModelPolicy{
		ChannelID:      12,
		RequestedModel: "gpt-5.6",
		ManualPriority: 80,
		Enabled:        true,
		Source:         PolicySourceMapped,
	}))
	got, err = GetChannelModelPolicy(12, "gpt-5.6")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, 80, got.ManualPriority)
	assert.True(t, got.Enabled)
	assert.Equal(t, PolicySourceMapped, got.Source)

	// second policy same channel, different requested model
	require.NoError(t, UpsertChannelModelPolicy(&ChannelModelPolicy{
		ChannelID:      12,
		RequestedModel: "gpt-5.6-latest",
		ManualPriority: 40,
		Enabled:        true,
		Source:         PolicySourceConfigured,
	}))
	byModel, err := ListChannelModelPoliciesByRequestedModel("gpt-5.6")
	require.NoError(t, err)
	require.Len(t, byModel, 1)
	byCh, err := ListChannelModelPoliciesByChannel(12)
	require.NoError(t, err)
	require.Len(t, byCh, 2)
}

func TestEnsureChannelModelPolicyLazyCreate(t *testing.T) {
	truncateTables(t)

	p, err := EnsureChannelModelPolicy(7, "claude-sonnet", PolicySourceLazyCreated, 0)
	require.NoError(t, err)
	require.NotNil(t, p)
	assert.Equal(t, int64(7), p.ChannelID)
	assert.Equal(t, "claude-sonnet", p.RequestedModel)
	assert.True(t, p.Enabled)
	assert.Equal(t, PolicySourceLazyCreated, p.Source)

	again, err := EnsureChannelModelPolicy(7, "claude-sonnet", PolicySourceConfigured, 99)
	require.NoError(t, err)
	require.NotNil(t, again)
	// existing row is returned; manual_priority not overwritten by Ensure
	assert.Equal(t, 0, again.ManualPriority)
	assert.Equal(t, PolicySourceLazyCreated, again.Source)
}

func TestChannelModelMetricsCRUDAndCalibration(t *testing.T) {
	truncateTables(t)

	m := &ChannelModelMetrics{
		ChannelID:      12,
		EffectiveModel: "provider-x/model-v3",
		RouteState:     string(RouteUnknown),
	}
	require.NoError(t, m.SetShadowCalibration(map[string]CalibrationBucket{
		CalibrationBucket0To1k: {Ratio: 1.1, SampleCount: 2},
	}))
	require.NoError(t, UpsertChannelModelMetrics(m))

	got, err := GetChannelModelMetrics(12, "provider-x/model-v3")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, string(RouteUnknown), got.RouteState)
	buckets, err := got.ParseShadowCalibration()
	require.NoError(t, err)
	require.Contains(t, buckets, CalibrationBucket0To1k)
	assert.InDelta(t, 1.1, buckets[CalibrationBucket0To1k].Ratio, 1e-9)

	// snapshot upsert updates state + EMA fields
	succ := 0.95
	got.SetState(RouteHealthy)
	got.ProductionSuccessEMA = &succ
	got.ProductionSampleCount = 10
	require.NoError(t, UpsertChannelModelMetrics(got))

	got2, err := GetChannelModelMetrics(12, "provider-x/model-v3")
	require.NoError(t, err)
	require.NotNil(t, got2)
	assert.Equal(t, string(RouteHealthy), got2.RouteState)
	require.NotNil(t, got2.ProductionSuccessEMA)
	assert.InDelta(t, 0.95, *got2.ProductionSuccessEMA, 1e-9)
	assert.Equal(t, int64(10), got2.ProductionSampleCount)

	// reset runtime keeps calibration
	require.NoError(t, ResetChannelModelMetricsRuntime(12, "provider-x/model-v3"))
	afterRuntime, err := GetChannelModelMetrics(12, "provider-x/model-v3")
	require.NoError(t, err)
	require.NotNil(t, afterRuntime)
	assert.Equal(t, int64(0), afterRuntime.ProductionSampleCount)
	assert.Nil(t, afterRuntime.ProductionSuccessEMA)
	buckets, err = afterRuntime.ParseShadowCalibration()
	require.NoError(t, err)
	require.Contains(t, buckets, CalibrationBucket0To1k)

	// full reset clears calibration
	require.NoError(t, ResetChannelModelMetricsAll(12, "provider-x/model-v3"))
	afterAll, err := GetChannelModelMetrics(12, "provider-x/model-v3")
	require.NoError(t, err)
	require.NotNil(t, afterAll)
	assert.Empty(t, afterAll.ShadowCalibrationJSON)
}

func TestEnsureChannelModelMetricsLazyCreate(t *testing.T) {
	truncateTables(t)

	m, err := EnsureChannelModelMetrics(3, "gpt-4o")
	require.NoError(t, err)
	require.NotNil(t, m)
	assert.Equal(t, string(RouteUnknown), m.RouteState)

	again, err := EnsureChannelModelMetrics(3, "gpt-4o")
	require.NoError(t, err)
	require.NotNil(t, again)
	assert.Equal(t, m.ChannelID, again.ChannelID)
}

func TestUpsertChannelModelPoliciesBatch(t *testing.T) {
	truncateTables(t)

	rows := []ChannelModelPolicy{
		{ChannelID: 1, RequestedModel: "a", ManualPriority: 10, Enabled: true, Source: PolicySourceConfigured},
		{ChannelID: 1, RequestedModel: "b", ManualPriority: 20, Enabled: true, Source: PolicySourceMapped},
		{ChannelID: 2, RequestedModel: "a", ManualPriority: 5, Enabled: true, Source: PolicySourceObserved},
	}
	require.NoError(t, UpsertChannelModelPolicies(rows))
	all, err := ListAllChannelModelPolicies()
	require.NoError(t, err)
	require.Len(t, all, 3)
}

func TestUpsertChannelModelMetricsBatch(t *testing.T) {
	truncateTables(t)

	rows := []ChannelModelMetrics{
		{ChannelID: 1, EffectiveModel: "m1", RouteState: string(RouteHealthy)},
		{ChannelID: 1, EffectiveModel: "m2", RouteState: string(RouteUnknown)},
	}
	require.NoError(t, UpsertChannelModelMetricsBatch(rows))
	all, err := ListAllChannelModelMetrics()
	require.NoError(t, err)
	require.Len(t, all, 2)
}
