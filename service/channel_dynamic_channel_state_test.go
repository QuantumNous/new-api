package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestParseChannelStatusMonitorSetting(t *testing.T) {
	t.Parallel()

	otherInfo := `{
		"status_monitor": {
			"enabled": true,
			"provider": "ikun",
			"provider_slug": "codex-pro",
			"request_model": "gpt-4o-mini",
			"monitor_id": "codex-pro:gpt-4o-mini",
			"monitor_name": "GPT-4o Mini"
		}
	}`

	setting := ParseChannelStatusMonitorSetting(otherInfo)
	require.NotNil(t, setting)
	require.True(t, setting.Enabled)
	require.Equal(t, "ikun", setting.Provider)
	require.Equal(t, "codex-pro", setting.ProviderSlug)
	require.Equal(t, "gpt-4o-mini", setting.RequestModel)
	require.Equal(t, "codex-pro:gpt-4o-mini", setting.MonitorID)
	require.Equal(t, "GPT-4o Mini", setting.MonitorName)
}

func TestPlanChannelStatusAdjustment_DisableWhenAllKnownUnhealthy(t *testing.T) {
	t.Parallel()

	plan := PlanChannelStatusAdjustment(ChannelStatusAdjustmentInput{
		ChannelID:         11,
		CurrentStatus:     common.ChannelStatusEnabled,
		HasAutoDisabled:   false,
		HasKnownSamples:   true,
		AllKnownUnhealthy: true,
		HasRecovered:      false,
		DryRun:            true,
	})

	require.Equal(t, ChannelStatusActionDisable, plan.Action)
	require.Equal(t, common.ChannelStatusAutoDisabled, plan.TargetStatus)
}

func TestPlanChannelStatusAdjustment_DoNothingForUnknownOnly(t *testing.T) {
	t.Parallel()

	plan := PlanChannelStatusAdjustment(ChannelStatusAdjustmentInput{
		ChannelID:         12,
		CurrentStatus:     common.ChannelStatusEnabled,
		HasAutoDisabled:   false,
		HasKnownSamples:   false,
		AllKnownUnhealthy: false,
		HasRecovered:      false,
		DryRun:            true,
	})

	require.Equal(t, ChannelStatusActionNone, plan.Action)
	require.Equal(t, common.ChannelStatusEnabled, plan.TargetStatus)
}

func TestPlanChannelStatusAdjustment_EnableWhenRecoveredAndAutoDisabled(t *testing.T) {
	t.Parallel()

	plan := PlanChannelStatusAdjustment(ChannelStatusAdjustmentInput{
		ChannelID:         13,
		CurrentStatus:     common.ChannelStatusAutoDisabled,
		HasAutoDisabled:   true,
		HasKnownSamples:   true,
		AllKnownUnhealthy: false,
		HasRecovered:      true,
		DryRun:            true,
	})

	require.Equal(t, ChannelStatusActionEnable, plan.Action)
	require.Equal(t, common.ChannelStatusEnabled, plan.TargetStatus)
}

func TestResolveStatusSampleUsesExplicitRequestModelMapping(t *testing.T) {
	t.Parallel()

	ability := dynamicAbilityRow{
		Group:       "default",
		Model:       "gpt-4o-mini",
		ChannelID:   1,
		ChannelName: "gptproto",
		Tag:         nil,
		ChannelOtherInfo: `{
			"status_monitor": {
				"enabled": true,
				"provider_slug": "codex-pro",
				"request_model": "gpt-4o-mini"
			}
		}`,
	}

	samples := map[string]dynamicStatusSample{
		externalStatusKey("codex-pro", "gpt-4o-mini"): {
			Provider:     "ikun",
			MonitorID:    "codex-pro:gpt-4o-mini",
			MonitorName:  "gpt-4o-mini",
			Source:       "ikun",
			State:        DynamicHealthHealthy,
			Status:       1,
			Availability: 100,
			Latency:      12,
			Reason:       "",
		},
	}

	sample, ok := statusSampleForAbility(ability, nil, samples)
	require.True(t, ok)
	require.Equal(t, DynamicHealthHealthy, sample.State)
	require.Equal(t, "ikun", sample.Source)
}

func TestShouldAutoDisableChannel(t *testing.T) {
	t.Parallel()

	channel := &model.Channel{
		Id:        99,
		Status:    common.ChannelStatusEnabled,
		OtherInfo: `{"dynamic_adjustment_auto_disabled":false}`,
	}

	require.True(t, shouldAutoDisableChannel(channel, []string{DynamicHealthUnhealthy, DynamicHealthUnhealthy}))
	require.False(t, shouldAutoDisableChannel(channel, []string{DynamicHealthHealthy, DynamicHealthUnhealthy}))
	require.False(t, shouldAutoDisableChannel(channel, []string{DynamicHealthUnknown}))
}

func TestPlanChannelStatusAdjustment_ManualDisabledNeverRecovered(t *testing.T) {
	t.Parallel()

	plan := PlanChannelStatusAdjustment(ChannelStatusAdjustmentInput{
		ChannelID:         21,
		CurrentStatus:     common.ChannelStatusManuallyDisabled,
		HasAutoDisabled:   true,
		HasKnownSamples:   true,
		AllKnownUnhealthy: false,
		HasRecovered:      true,
		DryRun:            false,
	})

	require.Equal(t, ChannelStatusActionNone, plan.Action)
	require.Equal(t, common.ChannelStatusManuallyDisabled, plan.TargetStatus)
}
