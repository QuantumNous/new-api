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
