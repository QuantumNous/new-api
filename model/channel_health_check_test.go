package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func boolPtr(v bool) *bool          { return &v }
func float64Ptr(v float64) *float64 { return &v }

func TestIsAutomaticHealthCheckEnabledDefaultsTrue(t *testing.T) {
	channel := &Channel{}
	assert.True(t, channel.IsAutomaticHealthCheckEnabled())

	channel.SetOtherSettings(dto.ChannelOtherSettings{
		HealthCheck: &dto.ChannelHealthCheckSettings{},
	})
	assert.True(t, channel.IsAutomaticHealthCheckEnabled())

	channel.SetOtherSettings(dto.ChannelOtherSettings{
		HealthCheck: &dto.ChannelHealthCheckSettings{Enabled: boolPtr(false)},
	})
	assert.False(t, channel.IsAutomaticHealthCheckEnabled())
}

func TestEffectiveHealthCheckDisableThresholdSeconds(t *testing.T) {
	original := common.ChannelDisableThreshold
	common.ChannelDisableThreshold = 5
	t.Cleanup(func() { common.ChannelDisableThreshold = original })

	channel := &Channel{}
	assert.Equal(t, 5.0, channel.EffectiveHealthCheckDisableThresholdSeconds())

	channel.SetOtherSettings(dto.ChannelOtherSettings{
		HealthCheck: &dto.ChannelHealthCheckSettings{
			DisableThresholdSeconds: float64Ptr(8),
		},
	})
	assert.Equal(t, 8.0, channel.EffectiveHealthCheckDisableThresholdSeconds())
}

func TestEffectiveHealthCheckEnableOnSuccessOverridesGlobal(t *testing.T) {
	original := common.AutomaticEnableChannelEnabled
	common.AutomaticEnableChannelEnabled = false
	t.Cleanup(func() { common.AutomaticEnableChannelEnabled = original })

	channel := &Channel{}
	assert.False(t, channel.EffectiveHealthCheckEnableOnSuccess())

	channel.SetOtherSettings(dto.ChannelOtherSettings{
		HealthCheck: &dto.ChannelHealthCheckSettings{
			EnableOnSuccess: boolPtr(true),
		},
	})
	assert.True(t, channel.EffectiveHealthCheckEnableOnSuccess())

	channel.SetOtherSettings(dto.ChannelOtherSettings{
		HealthCheck: &dto.ChannelHealthCheckSettings{
			EnableOnSuccess: boolPtr(false),
		},
	})
	common.AutomaticEnableChannelEnabled = true
	assert.False(t, channel.EffectiveHealthCheckEnableOnSuccess())
}

func TestEffectiveHealthCheckStreamFollowsCodexUnlessOverridden(t *testing.T) {
	channel := &Channel{Type: constant.ChannelTypeOpenAI}
	assert.False(t, channel.EffectiveHealthCheckStream())

	channel.Type = constant.ChannelTypeCodex
	assert.True(t, channel.EffectiveHealthCheckStream())

	channel.SetOtherSettings(dto.ChannelOtherSettings{
		HealthCheck: &dto.ChannelHealthCheckSettings{Stream: boolPtr(false)},
	})
	assert.False(t, channel.EffectiveHealthCheckStream())

	channel.Type = constant.ChannelTypeOpenAI
	channel.SetOtherSettings(dto.ChannelOtherSettings{
		HealthCheck: &dto.ChannelHealthCheckSettings{Stream: boolPtr(true)},
	})
	assert.True(t, channel.EffectiveHealthCheckStream())
}

func TestUpdateHealthCheckSettingsRMWPreservesOtherSettings(t *testing.T) {
	channel := &Channel{
		Name:   "hc-test",
		Key:    "secret",
		Status: common.ChannelStatusEnabled,
		Type:   constant.ChannelTypeOpenAI,
	}
	// Include an unknown legacy key so merge must preserve keys outside dto.ChannelOtherSettings.
	channel.OtherSettings = `{"azure_responses_version":"preview","upstream_model_update_check_enabled":true,"legacy_unknown_flag":true}`
	autoBan := 1
	channel.AutoBan = &autoBan
	require.NoError(t, DB.Create(channel).Error)
	t.Cleanup(func() {
		_ = DB.Unscoped().Delete(&Channel{}, channel.Id).Error
	})

	enabled := false
	threshold := 3.5
	require.NoError(t, UpdateHealthCheckSettings(channel.Id, common.GetPointer(0), &dto.ChannelHealthCheckSettings{
		Enabled:                 &enabled,
		DisableThresholdSeconds: &threshold,
		EndpointType:            string(constant.EndpointTypeOpenAI),
		Stream:                  boolPtr(true),
	}))

	var reloaded Channel
	require.NoError(t, DB.First(&reloaded, channel.Id).Error)
	require.NotNil(t, reloaded.AutoBan)
	assert.Equal(t, 0, *reloaded.AutoBan)

	settings := reloaded.GetOtherSettings()
	require.NotNil(t, settings.HealthCheck)
	require.NotNil(t, settings.HealthCheck.Enabled)
	assert.False(t, *settings.HealthCheck.Enabled)
	require.NotNil(t, settings.HealthCheck.DisableThresholdSeconds)
	assert.Equal(t, 3.5, *settings.HealthCheck.DisableThresholdSeconds)
	assert.Equal(t, string(constant.EndpointTypeOpenAI), settings.HealthCheck.EndpointType)
	require.NotNil(t, settings.HealthCheck.Stream)
	assert.True(t, *settings.HealthCheck.Stream)
	assert.Equal(t, "preview", settings.AzureResponsesVersion)
	assert.True(t, settings.UpstreamModelUpdateCheckEnabled)

	raw := map[string]any{}
	require.NoError(t, common.UnmarshalJsonStr(reloaded.OtherSettings, &raw))
	assert.Equal(t, true, raw["legacy_unknown_flag"])
}

func TestUpdateHealthCheckSettingsRejectsInvalidEndpoint(t *testing.T) {
	err := UpdateHealthCheckSettings(1, nil, &dto.ChannelHealthCheckSettings{
		EndpointType: "not-a-real-endpoint",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported endpoint_type")
}

func TestUpdateHealthCheckSettingsRejectsOversizedThreshold(t *testing.T) {
	err := UpdateHealthCheckSettings(1, nil, &dto.ChannelHealthCheckSettings{
		DisableThresholdSeconds: float64Ptr(maxHealthCheckDisableThresholdSeconds + 1),
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "disable_threshold_seconds must be <=")
}

func TestEffectiveHealthCheckDisableThresholdSecondsClamps(t *testing.T) {
	original := common.ChannelDisableThreshold
	common.ChannelDisableThreshold = 5
	t.Cleanup(func() { common.ChannelDisableThreshold = original })

	channel := &Channel{}
	channel.SetOtherSettings(dto.ChannelOtherSettings{
		HealthCheck: &dto.ChannelHealthCheckSettings{
			DisableThresholdSeconds: float64Ptr(maxHealthCheckDisableThresholdSeconds * 10),
		},
	})
	assert.Equal(t, maxHealthCheckDisableThresholdSeconds, channel.EffectiveHealthCheckDisableThresholdSeconds())
}
