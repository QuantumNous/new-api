package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

var testRecallActivitySMTPOptionKeys = []string{
	"recall_campaign_setting.smtp_server",
	"recall_campaign_setting.smtp_port",
	"recall_campaign_setting.smtp_account",
	"recall_campaign_setting.email_from",
	"recall_campaign_setting.smtp_token",
	"recall_campaign_setting.smtp_ssl_enabled",
	"recall_campaign_setting.smtp_force_auth_login",
}

func seedRecallActivitySMTPOptions(t *testing.T, values map[string]string) {
	t.Helper()

	for key, value := range values {
		require.NoError(t, DB.Create(&Option{Key: key, Value: value}).Error)
	}
	require.NoError(t, config.GlobalConfig.LoadFromDB(values))
	for key, value := range values {
		common.OptionMap[key] = value
	}
}

func requireRecallActivitySMTPPersisted(t *testing.T, expected map[string]string) {
	t.Helper()

	for key, value := range expected {
		require.Equal(t, value, persistedOptionValue(t, key), key)
		require.Equal(t, value, common.OptionMap[key], key)
	}
}

func TestRecallCampaignSettingSMTPAtomicSaveUpdatesEveryField(t *testing.T) {
	setupRecallSenderOptionTest(t)

	require.NoError(t, UpdateRecallActivitySMTPOptions(RecallActivitySMTPOptionInput{
		SMTPConfig: common.SMTPConfig{
			Server:         "smtp.activity.example.com",
			Port:           2525,
			Account:        "campaigns@example.com",
			From:           "Campaigns@Example.com",
			Token:          "secret-token",
			SSLEnabled:     true,
			ForceAuthLogin: true,
		},
	}))

	expected := map[string]string{
		"recall_campaign_setting.smtp_server":           "smtp.activity.example.com",
		"recall_campaign_setting.smtp_port":             "2525",
		"recall_campaign_setting.smtp_account":          "campaigns@example.com",
		"recall_campaign_setting.email_from":            "Campaigns@Example.com",
		"recall_campaign_setting.smtp_token":            "secret-token",
		"recall_campaign_setting.smtp_ssl_enabled":      "true",
		"recall_campaign_setting.smtp_force_auth_login": "true",
	}
	requireRecallActivitySMTPPersisted(t, expected)

	setting := operation_setting.GetRecallCampaignSetting()
	require.Equal(t, "smtp.activity.example.com", setting.SMTPServer)
	require.Equal(t, 2525, setting.SMTPPort)
	require.Equal(t, "campaigns@example.com", setting.SMTPAccount)
	require.Equal(t, "Campaigns@Example.com", setting.EmailFrom)
	require.Equal(t, "secret-token", setting.SMTPToken)
	require.True(t, setting.SMTPSSLEnabled)
	require.True(t, setting.SMTPForceAuthLogin)
}

func TestRecallCampaignSettingSMTPBlankSubmittedTokenPreservesStoredToken(t *testing.T) {
	setupRecallSenderOptionTest(t)
	seedRecallActivitySMTPOptions(t, map[string]string{
		"recall_campaign_setting.smtp_server":           "old.smtp.example.com",
		"recall_campaign_setting.smtp_port":             "25",
		"recall_campaign_setting.smtp_account":          "old@example.com",
		"recall_campaign_setting.email_from":            "Old@Example.com",
		"recall_campaign_setting.smtp_token":            "stored-token",
		"recall_campaign_setting.smtp_ssl_enabled":      "false",
		"recall_campaign_setting.smtp_force_auth_login": "false",
	})

	require.NoError(t, UpdateRecallActivitySMTPOptions(RecallActivitySMTPOptionInput{
		SMTPConfig: common.SMTPConfig{
			Server:         "new.smtp.example.com",
			Port:           587,
			Account:        "new@example.com",
			From:           "New@Example.com",
			Token:          "",
			SSLEnabled:     true,
			ForceAuthLogin: true,
		},
	}))

	require.Equal(t, "stored-token", persistedOptionValue(t, "recall_campaign_setting.smtp_token"))
	require.Equal(t, "stored-token", operation_setting.GetRecallCampaignSetting().SMTPToken)
}

func TestRecallCampaignSettingSMTPFailedDBWriteChangesNeitherDBNorRuntime(t *testing.T) {
	setupRecallSenderOptionTest(t)
	original := map[string]string{
		"recall_campaign_setting.smtp_server":           "old.smtp.example.com",
		"recall_campaign_setting.smtp_port":             "25",
		"recall_campaign_setting.smtp_account":          "old@example.com",
		"recall_campaign_setting.email_from":            "Old@Example.com",
		"recall_campaign_setting.smtp_token":            "stored-token",
		"recall_campaign_setting.smtp_ssl_enabled":      "false",
		"recall_campaign_setting.smtp_force_auth_login": "false",
	}
	seedRecallActivitySMTPOptions(t, original)
	require.NoError(t, DB.Exec(`
		CREATE TRIGGER fail_recall_activity_smtp_port_update
		BEFORE UPDATE ON options
		WHEN NEW.key = 'recall_campaign_setting.smtp_port'
		BEGIN
			SELECT RAISE(FAIL, 'forced smtp port write failure');
		END;
	`).Error)

	err := UpdateRecallActivitySMTPOptions(RecallActivitySMTPOptionInput{
		SMTPConfig: common.SMTPConfig{
			Server:         "new.smtp.example.com",
			Port:           587,
			Account:        "new@example.com",
			From:           "New@Example.com",
			Token:          "new-token",
			SSLEnabled:     true,
			ForceAuthLogin: true,
		},
	})

	require.ErrorContains(t, err, "forced smtp port write failure")
	requireRecallActivitySMTPPersisted(t, original)
	setting := operation_setting.GetRecallCampaignSetting()
	require.Equal(t, "old.smtp.example.com", setting.SMTPServer)
	require.Equal(t, 25, setting.SMTPPort)
	require.Equal(t, "old@example.com", setting.SMTPAccount)
	require.Equal(t, "Old@Example.com", setting.EmailFrom)
	require.Equal(t, "stored-token", setting.SMTPToken)
	require.False(t, setting.SMTPSSLEnabled)
	require.False(t, setting.SMTPForceAuthLogin)
}

func TestUpdateRecallActivitySMTPGenericUpdateRejectsDedicatedKeys(t *testing.T) {
	setupRecallSenderOptionTest(t)

	for _, key := range testRecallActivitySMTPOptionKeys {
		err := UpdateOption(key, "value")
		require.EqualError(t, err, "activity SMTP settings must be updated together", key)
	}
}

func TestRecallCampaignSettingSMTPReloadObservesCommittedValues(t *testing.T) {
	setupRecallSenderOptionTest(t)

	require.NoError(t, UpdateRecallActivitySMTPOptions(RecallActivitySMTPOptionInput{
		SMTPConfig: common.SMTPConfig{
			Server:         "committed.smtp.example.com",
			Port:           465,
			Account:        "committed@example.com",
			From:           "Committed@Example.com",
			Token:          "committed-token",
			SSLEnabled:     true,
			ForceAuthLogin: false,
		},
	}))
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.smtp_server":           "stale.smtp.example.com",
		"recall_campaign_setting.smtp_port":             "25",
		"recall_campaign_setting.smtp_account":          "stale@example.com",
		"recall_campaign_setting.email_from":            "Stale@Example.com",
		"recall_campaign_setting.smtp_token":            "stale-token",
		"recall_campaign_setting.smtp_ssl_enabled":      "false",
		"recall_campaign_setting.smtp_force_auth_login": "true",
	}))

	LoadOptionsFromDatabase()

	setting := operation_setting.GetRecallCampaignSetting()
	require.Equal(t, "committed.smtp.example.com", setting.SMTPServer)
	require.Equal(t, 465, setting.SMTPPort)
	require.Equal(t, "committed@example.com", setting.SMTPAccount)
	require.Equal(t, "Committed@Example.com", setting.EmailFrom)
	require.Equal(t, "committed-token", setting.SMTPToken)
	require.True(t, setting.SMTPSSLEnabled)
	require.False(t, setting.SMTPForceAuthLogin)
}
