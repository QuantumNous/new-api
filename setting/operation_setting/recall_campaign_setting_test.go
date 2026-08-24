package operation_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/require"
)

func TestRecallCampaignSettingDefaultsDisabled(t *testing.T) {
	require.False(t, IsRecallCampaignEnabled())
}

func TestRecallCampaignSettingDefaultsBatchSize(t *testing.T) {
	require.Equal(t, 100, GetRecallCampaignSetting().BatchSize)
}

func TestRecallCampaignSettingDefaultsTickSeconds(t *testing.T) {
	require.Equal(t, 30, GetRecallCampaignSetting().TickSeconds)
}

func TestRecallCampaignSettingDefaultsEmailHourlyLimit(t *testing.T) {
	require.Equal(t, 100, GetRecallCampaignSetting().EmailHourlyLimit)
}

func TestRecallCampaignSettingLoadsEmailFromFromConfigMap(t *testing.T) {
	cfg := RecallCampaignSetting{}

	err := config.UpdateConfigFromMap(&cfg, map[string]string{
		"enabled":            "true",
		"batch_size":         "25",
		"tick_seconds":       "15",
		"email_hourly_limit": "250",
		"email_from":         "Campaigns@Example.com",
	})

	require.NoError(t, err)
	require.True(t, cfg.Enabled)
	require.Equal(t, 25, cfg.BatchSize)
	require.Equal(t, 15, cfg.TickSeconds)
	require.Equal(t, 250, cfg.EmailHourlyLimit)
	require.Equal(t, "Campaigns@Example.com", cfg.EmailFrom)
}

func TestRecallCampaignSettingLoadsSMTPFieldsFromConfigMap(t *testing.T) {
	cfg := RecallCampaignSetting{}

	err := config.UpdateConfigFromMap(&cfg, map[string]string{
		"smtp_server":           "smtp.activity.example.com",
		"smtp_port":             "2525",
		"smtp_account":          "campaigns@example.com",
		"email_from":            "Campaigns@Example.com",
		"smtp_token":            "secret-token",
		"smtp_ssl_enabled":      "true",
		"smtp_force_auth_login": "true",
	})

	require.NoError(t, err)
	require.Equal(t, "smtp.activity.example.com", cfg.SMTPServer)
	require.Equal(t, 2525, cfg.SMTPPort)
	require.Equal(t, "campaigns@example.com", cfg.SMTPAccount)
	require.Equal(t, "Campaigns@Example.com", cfg.EmailFrom)
	require.Equal(t, "secret-token", cfg.SMTPToken)
	require.True(t, cfg.SMTPSSLEnabled)
	require.True(t, cfg.SMTPForceAuthLogin)
}

func TestRecallCampaignSettingNormalizeAndValidate(t *testing.T) {
	cfg := RecallCampaignSetting{BatchSize: 25, TickSeconds: 15, EmailHourlyLimit: 100}
	require.NoError(t, cfg.NormalizeAndValidate())

	cfg = RecallCampaignSetting{BatchSize: 0, TickSeconds: 30, EmailHourlyLimit: 100}
	require.Error(t, cfg.NormalizeAndValidate())
}

func TestRecallCampaignSettingRejectsEmailHourlyLimitOutsideRange(t *testing.T) {
	for _, limit := range []int{0, 100001} {
		cfg := RecallCampaignSetting{
			BatchSize:        100,
			TickSeconds:      30,
			EmailHourlyLimit: limit,
		}
		require.ErrorContains(t, cfg.NormalizeAndValidate(), "email hourly limit")
	}
}
