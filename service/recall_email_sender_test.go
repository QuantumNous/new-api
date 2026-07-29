package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/require"
)

func TestRecallEmailSenderStatusDefaultsToSMTPFromWithoutSecrets(t *testing.T) {
	restoreRecallEmailSenderConfig(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "smtp-login@example.com"
	common.SMTPFromAliases = "Campaigns@Example.com,alerts@example.com"
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.email_from": "",
	}))

	status, err := GetRecallEmailSenderStatus()
	require.NoError(t, err)

	require.Equal(t, "", status.ConfiguredEmailFrom)
	require.Equal(t, "system@example.com", status.EffectiveEmailFrom)
	require.True(t, status.UsesDefault)
	require.Equal(t, []RecallEmailSenderOption{
		{Email: "system@example.com", IsDefault: true},
		{Email: "Campaigns@Example.com"},
		{Email: "alerts@example.com"},
	}, status.Options)

	body := string(recallEmailSenderMustMarshal(t, status))
	require.NotContains(t, body, "smtp-login@example.com")
	require.NotContains(t, body, "SMTP")
	require.NotContains(t, body, "token")
	require.NotContains(t, body, "server")
}

func TestRecallEmailSenderStatusUsesCanonicalAlias(t *testing.T) {
	restoreRecallEmailSenderConfig(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "smtp-login@example.com"
	common.SMTPFromAliases = "Campaigns@Example.com,alerts@example.com"
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.email_from": "Campaigns@Example.com",
	}))

	status, err := GetRecallEmailSenderStatus()
	require.NoError(t, err)

	require.Equal(t, "Campaigns@Example.com", status.ConfiguredEmailFrom)
	require.Equal(t, "Campaigns@Example.com", status.EffectiveEmailFrom)
	require.False(t, status.UsesDefault)
}

func TestRecallEmailSenderSelectionNormalizesOnlyConfiguredAliases(t *testing.T) {
	restoreRecallEmailSenderConfig(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "smtp-login@example.com"
	common.SMTPFromAliases = "Campaigns@Example.com,alerts@example.com"

	normalized, err := NormalizeRecallEmailSenderSelection(" campaigns@example.com ")
	require.NoError(t, err)
	require.Equal(t, "Campaigns@Example.com", normalized)

	normalized, err = NormalizeRecallEmailSenderSelection(" ")
	require.NoError(t, err)
	require.Equal(t, "", normalized)

	for _, value := range []string{"missing@example.com", "system@example.com"} {
		_, err := NormalizeRecallEmailSenderSelection(value)
		require.ErrorContains(t, err, "configured SMTP aliases")
	}
}

func recallEmailSenderMustMarshal(t *testing.T, value any) []byte {
	t.Helper()
	data, err := common.Marshal(value)
	require.NoError(t, err)
	return data
}

func restoreRecallEmailSenderConfig(t *testing.T) {
	t.Helper()
	originalFrom := common.SMTPFrom
	originalAccount := common.SMTPAccount
	originalAliases := common.SMTPFromAliases
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.email_from": "",
	}))
	t.Cleanup(func() {
		common.SMTPFrom = originalFrom
		common.SMTPAccount = originalAccount
		common.SMTPFromAliases = originalAliases
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
			"recall_campaign_setting.email_from": "",
		}))
	})
}
