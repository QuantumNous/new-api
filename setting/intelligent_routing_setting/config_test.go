package intelligent_routing_setting

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeConfigAppliesSafeDefaults(t *testing.T) {
	got, err := Normalize(Config{Enabled: true})
	require.NoError(t, err)
	assert.Equal(t, 1, got.PolicyVersion)
	assert.Equal(t, 4, got.MaxAttempts)
	assert.Equal(t, 2, got.MaxEndpointsPerModel)
	assert.Equal(t, 30*time.Second, got.NonStreamBudget)
	assert.Equal(t, 12*time.Second, got.StreamFirstByteBudget)
	assert.InDelta(t, 2.5, got.MaxCostMultiplier, 0.0001)
	assert.InDelta(t, 0.98, got.QualityThresholds[TaskTool], 0.0001)
}

func TestNormalizeConfigRejectsInvalidValues(t *testing.T) {
	tests := []Config{
		{MaxAttempts: -1},
		{QualityThresholds: map[TaskType]float64{TaskGeneral: 1.1}},
		{Models: []ModelPolicy{{Model: "a", Tier: 4}}},
		{Models: []ModelPolicy{{Model: "a"}, {Model: "a"}}},
	}
	for _, input := range tests {
		_, err := Normalize(input)
		assert.Error(t, err)
	}
}

func TestUpdatePublishesIndependentSnapshot(t *testing.T) {
	require.NoError(t, Update(Config{Enabled: true, Models: []ModelPolicy{{Model: "cheap", Tier: 0}}}))
	first := Get()
	first.Models[0].Model = "changed"
	second := Get()
	assert.Equal(t, "cheap", second.Models[0].Model)
	assert.True(t, Enabled())
}
