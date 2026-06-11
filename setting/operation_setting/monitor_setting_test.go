package operation_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/require"
)

func TestMonitorSettingDingTalkDefaults(t *testing.T) {
	setting := GetMonitorSetting()

	require.False(t, setting.DingTalkAlertEnabled)
	require.Empty(t, setting.DingTalkAlertWebhookURL)
	require.Empty(t, setting.DingTalkAlertSecret)
	require.Equal(t, 60.0, setting.DingTalkAlertCooldownMinutes)
}

func TestMonitorSettingLoadsDingTalkFieldsFromConfigMap(t *testing.T) {
	setting := &MonitorSetting{}

	err := config.UpdateConfigFromMap(setting, map[string]string{
		"dingtalk_alert_enabled":          "true",
		"dingtalk_alert_webhook_url":      "https://oapi.dingtalk.com/robot/send?access_token=abc",
		"dingtalk_alert_secret":           "secret",
		"dingtalk_alert_cooldown_minutes": "15",
	})

	require.NoError(t, err)
	require.True(t, setting.DingTalkAlertEnabled)
	require.Equal(t, "https://oapi.dingtalk.com/robot/send?access_token=abc", setting.DingTalkAlertWebhookURL)
	require.Equal(t, "secret", setting.DingTalkAlertSecret)
	require.Equal(t, 15.0, setting.DingTalkAlertCooldownMinutes)
}

func TestMonitorSettingLoadsAIAnalysisAPIKeyFromConfigMap(t *testing.T) {
	setting := &MonitorSetting{}

	err := config.UpdateConfigFromMap(setting, map[string]string{
		"ai_analysis_api_key": "sk-monitor",
	})

	require.NoError(t, err)
	require.Equal(t, "sk-monitor", setting.AIAnalysisAPIKey)
}

func TestMonitorSettingLoadsAIAnalysisEndpointFieldsFromConfigMap(t *testing.T) {
	setting := &MonitorSetting{}

	err := config.UpdateConfigFromMap(setting, map[string]string{
		"ai_analysis_base_url": "https://ai-gateway.example.com/v1",
		"ai_analysis_model":    "gpt-monitor",
	})

	require.NoError(t, err)
	require.Equal(t, "https://ai-gateway.example.com/v1", setting.AIAnalysisBaseURL)
	require.Equal(t, "gpt-monitor", setting.AIAnalysisModel)
}

func TestMonitorSettingLoadsChannelTypeFiltersFromConfigMap(t *testing.T) {
	setting := &MonitorSetting{}

	err := config.UpdateConfigFromMap(setting, map[string]string{
		"auto_test_channel_allowed_types": "[57,24]",
		"auto_test_channel_ignored_types": "[2,5]",
	})

	require.NoError(t, err)
	require.Equal(t, []int{57, 24}, setting.AutoTestChannelAllowedTypes)
	require.Equal(t, []int{2, 5}, setting.AutoTestChannelIgnoredTypes)
}
