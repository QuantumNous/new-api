package model

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
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

func TestModelPolicyPriorityUpdateAndSwap(t *testing.T) {
	truncateTables(t)
	seedModelPolicies(t, "gpt-priority", map[int64]int{1: 100, 2: 90, 3: 80})

	result, err := UpdateChannelModelPolicyPriority(2, "gpt-priority", 95, 90)
	require.NoError(t, err)
	require.Len(t, result.Changed, 1)
	assert.Equal(t, ModelPolicyPriorityChange{ChannelID: 2, ManualPriority: 95}, result.Changed[0])
	assertModelPolicyPriorities(t, "gpt-priority", map[int64]int{1: 100, 2: 95, 3: 80})

	result, err = UpdateChannelModelPolicyPriority(2, "gpt-priority", 100, 95)
	require.NoError(t, err)
	assert.ElementsMatch(t, []ModelPolicyPriorityChange{
		{ChannelID: 2, ManualPriority: 100},
		{ChannelID: 1, ManualPriority: 95},
	}, result.Changed)
	assertModelPolicyPriorities(t, "gpt-priority", map[int64]int{1: 95, 2: 100, 3: 80})
}

func TestModelPolicyPriorityUpdateRejectsConflictAndStaleSnapshot(t *testing.T) {
	truncateTables(t)
	seedModelPolicies(t, "gpt-priority", map[int64]int{1: 100, 2: 90, 3: 100})

	_, err := UpdateChannelModelPolicyPriority(2, "gpt-priority", 100, 90)
	assert.ErrorIs(t, err, ErrModelPolicyDuplicatePriorityConflict)
	assertModelPolicyPriorities(t, "gpt-priority", map[int64]int{1: 100, 2: 90, 3: 100})

	_, err = UpdateChannelModelPolicyPriority(2, "gpt-priority", 80, 89)
	assert.ErrorIs(t, err, ErrModelPolicyStaleSnapshot)
	assertModelPolicyPriorities(t, "gpt-priority", map[int64]int{1: 100, 2: 90, 3: 100})
}

func TestModelPolicyPrioritySwapRollsBackOnWriteFailure(t *testing.T) {
	truncateTables(t)
	seedModelPolicies(t, "gpt-priority", map[int64]int{1: 100, 2: 90})

	updateCount := 0
	callbackName := "test:model-policy-swap-failure"
	require.NoError(t, DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		updateCount++
		if updateCount == 2 {
			tx.AddError(errors.New("injected second update failure"))
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Update().Remove(callbackName))
	})

	_, err := UpdateChannelModelPolicyPriority(2, "gpt-priority", 100, 90)
	require.Error(t, err)
	assertModelPolicyPriorities(t, "gpt-priority", map[int64]int{1: 100, 2: 90})
}

func TestModelPolicyReorderUsesGapAndMinimumLocalShift(t *testing.T) {
	tests := []struct {
		name     string
		initial  map[int64]int
		ordered  []int64
		moved    int64
		expected map[int64]int
	}{
		{
			name:     "midpoint gap",
			initial:  map[int64]int{1: 100, 2: 90, 3: 0},
			ordered:  []int64{1, 3, 2},
			moved:    3,
			expected: map[int64]int{1: 100, 2: 90, 3: 95},
		},
		{
			name:     "dense range shifts upward when cheaper",
			initial:  map[int64]int{12: 99, 8: 98, 3: 97, 19: 0},
			ordered:  []int64{12, 19, 8, 3},
			moved:    19,
			expected: map[int64]int{12: 100, 19: 99, 8: 98, 3: 97},
		},
		{
			name:     "dense range shifts downward when cheaper",
			initial:  map[int64]int{1: 100, 2: 99, 3: 98, 4: 0},
			ordered:  []int64{1, 2, 4, 3},
			moved:    4,
			expected: map[int64]int{1: 100, 2: 99, 4: 98, 3: 97},
		},
		{
			name:     "equal costs prefer downward",
			initial:  map[int64]int{1: 100, 2: 99, 3: 98, 4: 97},
			ordered:  []int64{1, 3, 2, 4},
			moved:    3,
			expected: map[int64]int{1: 100, 3: 99, 2: 98, 4: 97},
		},
		{
			name:     "duplicate priorities are split locally",
			initial:  map[int64]int{1: 9999, 2: 9999, 3: 0},
			ordered:  []int64{1, 3, 2},
			moved:    3,
			expected: map[int64]int{1: 9999, 3: 9998, 2: 9997},
		},
		{
			name:     "large manual gap remains intact",
			initial:  map[int64]int{1: 9000, 2: 100, 3: 99, 4: 98, 5: 0},
			ordered:  []int64{1, 2, 5, 3, 4},
			moved:    5,
			expected: map[int64]int{1: 9000, 2: 101, 5: 100, 3: 99, 4: 98},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			truncateTables(t)
			seedModelPolicies(t, "gpt-priority", test.initial)
			seedModelPolicies(t, "other-model", map[int64]int{99: 42})

			result, err := ReorderChannelModelPoliciesForChannel(
				"gpt-priority",
				test.ordered,
				modelPolicySnapshots(test.initial),
				test.moved,
			)
			require.NoError(t, err)
			assert.Equal(t, test.ordered, result.CurrentOrder)
			assertModelPolicyPriorities(t, "gpt-priority", test.expected)
			assertModelPolicyPriorities(t, "other-model", map[int64]int{99: 42})
		})
	}
}

func TestModelPolicyReorderEdgesAndSnapshotRollback(t *testing.T) {
	truncateTables(t)
	initial := map[int64]int{1: 9999, 2: 20, 3: 10}
	seedModelPolicies(t, "gpt-priority", initial)

	result, err := ReorderChannelModelPoliciesForChannel(
		"gpt-priority",
		[]int64{2, 1, 3},
		modelPolicySnapshots(initial),
		2,
	)
	require.NoError(t, err)
	assert.Equal(t, []int64{2, 1, 3}, result.CurrentOrder)
	assertModelPolicyPriorities(t, "gpt-priority", map[int64]int{2: 9999, 1: 9998, 3: 10})

	stale := []ModelPolicyPrioritySnapshot{
		{ChannelID: 1, ManualPriority: 9998},
		{ChannelID: 2, ManualPriority: 9998},
		{ChannelID: 3, ManualPriority: 10},
	}
	_, err = ReorderChannelModelPoliciesForChannel("gpt-priority", []int64{2, 3, 1}, stale, 1)
	assert.ErrorIs(t, err, ErrModelPolicyStaleSnapshot)
	assertModelPolicyPriorities(t, "gpt-priority", map[int64]int{2: 9999, 1: 9998, 3: 10})

	truncateTables(t)
	lowerBoundary := map[int64]int{1: 10, 2: 0, 3: ModelPolicyPriorityMin}
	seedModelPolicies(t, "gpt-priority", lowerBoundary)
	_, err = ReorderChannelModelPoliciesForChannel(
		"gpt-priority",
		[]int64{2, 3, 1},
		modelPolicySnapshots(lowerBoundary),
		1,
	)
	require.NoError(t, err)
	assertModelPolicyPriorities(t, "gpt-priority", map[int64]int{
		1: ModelPolicyPriorityMin,
		2: 0,
		3: ModelPolicyPriorityMin + 1,
	})
}

func TestModelPolicyReorderReportsExhaustedPriorityRange(t *testing.T) {
	priorityCount := ModelPolicyPriorityMax - ModelPolicyPriorityMin + 1
	policies := make([]ChannelModelPolicy, 0, priorityCount+1)
	desired := make([]int64, 0, priorityCount+1)
	var channelID int64 = 1
	insertAt := 0
	for priority := ModelPolicyPriorityMax; priority >= ModelPolicyPriorityMin; priority-- {
		policies = append(policies, ChannelModelPolicy{ChannelID: channelID, ManualPriority: priority})
		desired = append(desired, channelID)
		if priority == 0 {
			insertAt = len(desired)
		}
		channelID++
	}
	movedChannelID := channelID
	policies = append(policies, ChannelModelPolicy{
		ChannelID: movedChannelID, ManualPriority: ModelPolicyPriorityMin,
	})
	desired = append(desired, 0)
	copy(desired[insertAt+1:], desired[insertAt:])
	desired[insertAt] = movedChannelID

	assert.Nil(t, buildModelPolicyReorderCandidate(policies, desired, movedChannelID))
}

func seedModelPolicies(t *testing.T, requestedModel string, priorities map[int64]int) {
	t.Helper()
	policies := make([]ChannelModelPolicy, 0, len(priorities))
	for channelID, priority := range priorities {
		policies = append(policies, ChannelModelPolicy{
			ChannelID:      channelID,
			RequestedModel: requestedModel,
			ManualPriority: priority,
			Enabled:        true,
			Source:         PolicySourceConfigured,
		})
	}
	require.NoError(t, UpsertChannelModelPolicies(policies))
}

func modelPolicySnapshots(priorities map[int64]int) []ModelPolicyPrioritySnapshot {
	snapshots := make([]ModelPolicyPrioritySnapshot, 0, len(priorities))
	for channelID, priority := range priorities {
		snapshots = append(snapshots, ModelPolicyPrioritySnapshot{
			ChannelID:      channelID,
			ManualPriority: priority,
		})
	}
	return snapshots
}

func assertModelPolicyPriorities(t *testing.T, requestedModel string, expected map[int64]int) {
	t.Helper()
	policies, err := ListChannelModelPoliciesByRequestedModel(requestedModel)
	require.NoError(t, err)
	require.Len(t, policies, len(expected))
	for i := range policies {
		assert.Equal(t, expected[policies[i].ChannelID], policies[i].ManualPriority, "channel %d", policies[i].ChannelID)
	}
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
