package dto

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMergeEffortIntoOutputConfig_NilExisting(t *testing.T) {
	result := MergeEffortIntoOutputConfig(nil, "xhigh")
	var m map[string]any
	require.NoError(t, json.Unmarshal(result, &m))
	require.Equal(t, "xhigh", m["effort"])
	require.Len(t, m, 1)
}

func TestMergeEffortIntoOutputConfig_PreservesTaskBudget(t *testing.T) {
	existing := json.RawMessage(`{"task_budget":{"type":"tokens","total":50000}}`)
	result := MergeEffortIntoOutputConfig(existing, "high")
	var m map[string]any
	require.NoError(t, json.Unmarshal(result, &m))
	require.Equal(t, "high", m["effort"])
	tb, ok := m["task_budget"].(map[string]any)
	require.True(t, ok, "task_budget should be preserved")
	require.Equal(t, "tokens", tb["type"])
	require.Equal(t, float64(50000), tb["total"])
}

func TestMergeEffortIntoOutputConfig_OverridesExistingEffort(t *testing.T) {
	existing := json.RawMessage(`{"effort":"low","task_budget":{"type":"tokens","total":20000}}`)
	result := MergeEffortIntoOutputConfig(existing, "xhigh")
	var m map[string]any
	require.NoError(t, json.Unmarshal(result, &m))
	require.Equal(t, "xhigh", m["effort"])
	_, ok := m["task_budget"]
	require.True(t, ok, "task_budget should be preserved after effort override")
}

func TestMergeEffortIntoOutputConfig_EmptyJSON(t *testing.T) {
	existing := json.RawMessage(`{}`)
	result := MergeEffortIntoOutputConfig(existing, "medium")
	var m map[string]any
	require.NoError(t, json.Unmarshal(result, &m))
	require.Equal(t, "medium", m["effort"])
	require.Len(t, m, 1)
}
