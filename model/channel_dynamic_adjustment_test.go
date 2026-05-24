package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChannelDynamicAdjustmentTables_RoundTrip(t *testing.T) {
	truncateTables(t)
	require.NoError(t, EnsureChannelDynamicAdjustmentTables())

	priority := int64(10)
	override := ChannelDynamicOverride{
		ChannelID:       11,
		Group:           "default",
		Model:           "gpt-4o",
		Provider:        "ikun",
		MonitorID:       "codex-pro:gpt-4o",
		MonitorName:     "gpt-4o",
		Source:          "ikun",
		State:           "degraded",
		BaseEnabled:     true,
		BasePriority:    &priority,
		BaseWeight:      100,
		AppliedEnabled:  true,
		AppliedPriority: &priority,
		AppliedWeight:   50,
		DryRun:          true,
		Active:          true,
		LastReason:      "availability=86",
		UpdatedAt:       100,
	}
	require.NoError(t, UpsertChannelDynamicOverride(override))

	overrides, total, err := ListChannelDynamicOverrides(ChannelDynamicOverrideQuery{ChannelID: 11, Page: 1, Limit: 20})
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, overrides, 1)
	require.Equal(t, "degraded", overrides[0].State)
	require.EqualValues(t, 50, overrides[0].AppliedWeight)

	log := ChannelDynamicAdjustmentLog{
		ChannelID:      11,
		Group:          "default",
		Model:          "gpt-4o",
		Provider:       "ikun",
		Source:         "ikun",
		State:          "degraded",
		Action:         "adjust_weight",
		DryRun:         true,
		Protected:      false,
		Reason:         "availability=86",
		BeforeEnabled:  true,
		BeforePriority: &priority,
		BeforeWeight:   100,
		AfterEnabled:   true,
		AfterPriority:  &priority,
		AfterWeight:    50,
		CreatedAt:      101,
	}
	require.NoError(t, CreateChannelDynamicAdjustmentLog(log))

	logs, logTotal, err := ListChannelDynamicAdjustmentLogs(ChannelDynamicLogQuery{Action: "adjust_weight", Page: 1, Limit: 20})
	require.NoError(t, err)
	require.EqualValues(t, 1, logTotal)
	require.Len(t, logs, 1)
	require.Equal(t, "availability=86", logs[0].Reason)
}

func TestChannelProbeResult_RoundTrip(t *testing.T) {
	truncateTables(t)
	require.NoError(t, EnsureChannelDynamicAdjustmentTables())

	result := ChannelProbeResult{
		ChannelID:    12,
		Group:        "vip",
		Model:        "gptproto",
		ProbeType:    "model_inference",
		Status:       "unhealthy",
		Latency:      3000,
		ErrorMessage: "timeout",
		CheckedAt:    200,
	}
	require.NoError(t, UpsertChannelProbeResult(result))

	results, total, err := ListChannelProbeResults(ChannelProbeResultQuery{Status: "unhealthy", Page: 1, Limit: 20})
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, results, 1)
	require.Equal(t, "gptproto", results[0].Model)
	require.Equal(t, "timeout", results[0].ErrorMessage)
}
