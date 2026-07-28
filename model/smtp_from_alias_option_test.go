package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func setupRecallSenderOptionTest(t *testing.T) {
	t.Helper()

	originalFrom := common.SMTPFrom
	originalAccount := common.SMTPAccount
	originalAliases := common.SMTPFromAliases
	originalOptionMap := common.OptionMap
	originalConfig := config.GlobalConfig.ExportAllConfigs()

	setupOptionGroupRenameTestDB(t)

	t.Cleanup(func() {
		common.SMTPFrom = originalFrom
		common.SMTPAccount = originalAccount
		common.SMTPFromAliases = originalAliases
		common.OptionMap = originalOptionMap
		require.NoError(t, config.GlobalConfig.LoadFromDB(originalConfig))
	})
}

func persistedOptionValue(t *testing.T, key string) string {
	t.Helper()

	var option Option
	require.NoError(t, DB.Where("key = ?", key).First(&option).Error)
	return option.Value
}

func seedRecallSenderOptions(t *testing.T, values map[string]string) {
	t.Helper()

	for key, value := range values {
		require.NoError(t, DB.Create(&Option{Key: key, Value: value}).Error)
	}
}

func TestUpdateOptionNormalizesAndSyncsSMTPFromAliases(t *testing.T) {
	setupRecallSenderOptionTest(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "login@example.com"

	require.NoError(t, UpdateOption("SMTPFromAliases", " Campaigns@Example.com\nalerts@example.com,campaigns@example.com "))

	require.Equal(t, "Campaigns@Example.com,alerts@example.com", persistedOptionValue(t, "SMTPFromAliases"))
	require.Equal(t, "Campaigns@Example.com,alerts@example.com", common.SMTPFromAliases)
	require.Equal(t, "Campaigns@Example.com,alerts@example.com", common.OptionMap["SMTPFromAliases"])
}

func TestUpdateOptionLoadSMTPFromAliasesSynchronizesRuntime(t *testing.T) {
	setupRecallSenderOptionTest(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "login@example.com"
	require.NoError(t, DB.Create(&Option{Key: "SMTPFromAliases", Value: "alerts@example.com"}).Error)

	InitOptionMap()

	require.Contains(t, common.OptionMap, "SMTPFromAliases")
	require.Equal(t, "alerts@example.com", common.SMTPFromAliases)
	require.Equal(t, "alerts@example.com", common.OptionMap["SMTPFromAliases"])
}

func TestUpdateOptionRejectsSMTPFromAliasesRemovingCurrentlySelectedRecallSender(t *testing.T) {
	setupRecallSenderOptionTest(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "login@example.com"
	common.SMTPFromAliases = "campaigns@example.com,alerts@example.com"
	common.OptionMap["SMTPFromAliases"] = "campaigns@example.com,alerts@example.com"
	seedRecallSenderOptions(t, map[string]string{
		"SMTPFrom":                           "system@example.com",
		"SMTPAccount":                        "login@example.com",
		"SMTPFromAliases":                    "campaigns@example.com,alerts@example.com",
		"recall_campaign_setting.email_from": "campaigns@example.com",
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.email_from": "campaigns@example.com",
	}))

	err := UpdateOption("SMTPFromAliases", "alerts@example.com")

	require.ErrorContains(t, err, "currently selected")
	require.Equal(t, "campaigns@example.com,alerts@example.com", persistedOptionValue(t, "SMTPFromAliases"))
	require.Equal(t, "campaigns@example.com,alerts@example.com", common.SMTPFromAliases)
	require.Equal(t, "campaigns@example.com,alerts@example.com", common.OptionMap["SMTPFromAliases"])
	require.Equal(t, "campaigns@example.com", operation_setting.GetRecallCampaignSetting().EmailFrom)
}

func TestUpdateOptionRecallSenderPersistsCanonicalConfiguredAlias(t *testing.T) {
	setupRecallSenderOptionTest(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "login@example.com"
	common.SMTPFromAliases = "Campaigns@Example.com,alerts@example.com"
	seedRecallSenderOptions(t, map[string]string{
		"SMTPFrom":                           "system@example.com",
		"SMTPAccount":                        "login@example.com",
		"SMTPFromAliases":                    "Campaigns@Example.com,alerts@example.com",
		"recall_campaign_setting.email_from": "",
	})

	require.NoError(t, UpdateOption("recall_campaign_setting.email_from", "campaigns@example.com"))

	require.Equal(t, "Campaigns@Example.com", persistedOptionValue(t, "recall_campaign_setting.email_from"))
	require.Equal(t, "Campaigns@Example.com", operation_setting.GetRecallCampaignSetting().EmailFrom)
}

func TestUpdateOptionRecallSenderAcceptsEmptyAndRejectsInvalidSelections(t *testing.T) {
	setupRecallSenderOptionTest(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "login@example.com"
	common.SMTPFromAliases = "Campaigns@Example.com,alerts@example.com"
	seedRecallSenderOptions(t, map[string]string{
		"SMTPFrom":                           "system@example.com",
		"SMTPAccount":                        "login@example.com",
		"SMTPFromAliases":                    "Campaigns@Example.com,alerts@example.com",
		"recall_campaign_setting.email_from": "",
	})

	require.NoError(t, UpdateOption("recall_campaign_setting.email_from", " "))
	require.Equal(t, "", persistedOptionValue(t, "recall_campaign_setting.email_from"))
	require.Empty(t, operation_setting.GetRecallCampaignSetting().EmailFrom)

	for _, value := range []string{"not-an-email", "billing@example.com", "system@example.com"} {
		err := UpdateOption("recall_campaign_setting.email_from", value)
		require.ErrorContains(t, err, "Activity sender must be one of the configured SMTP aliases")
		require.Equal(t, "", persistedOptionValue(t, "recall_campaign_setting.email_from"))
		require.Empty(t, operation_setting.GetRecallCampaignSetting().EmailFrom)
	}
}

func TestUpdateOptionRejectsSMTPFromChangeThatOrphansRecallSender(t *testing.T) {
	setupRecallSenderOptionTest(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "login@example.com"
	common.SMTPFromAliases = "alerts@example.com"
	common.OptionMap["SMTPFrom"] = "system@example.com"
	seedRecallSenderOptions(t, map[string]string{
		"SMTPFrom":                           "system@example.com",
		"SMTPAccount":                        "login@example.com",
		"SMTPFromAliases":                    "alerts@example.com",
		"recall_campaign_setting.email_from": "system@example.com",
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.email_from": "system@example.com",
	}))

	err := UpdateOption("SMTPFrom", "new-default@example.com")

	require.Error(t, err)
	require.Equal(t, "system@example.com", persistedOptionValue(t, "SMTPFrom"))
	require.Equal(t, "system@example.com", common.SMTPFrom)
	require.Equal(t, "system@example.com", common.OptionMap["SMTPFrom"])
	require.Equal(t, "system@example.com", operation_setting.GetRecallCampaignSetting().EmailFrom)

	require.NoError(t, UpdateOption("SMTPFrom", "system@example.com"))
	require.Equal(t, "system@example.com", persistedOptionValue(t, "SMTPFrom"))
	require.Equal(t, "system@example.com", common.SMTPFrom)
}

func TestUpdateOptionSMTPFromAllowsRecallSenderToBecomeDefault(t *testing.T) {
	setupRecallSenderOptionTest(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "login@example.com"
	common.SMTPFromAliases = "Campaigns@Example.com,alerts@example.com"
	common.OptionMap["SMTPFrom"] = "system@example.com"
	seedRecallSenderOptions(t, map[string]string{
		"SMTPFrom":                           "system@example.com",
		"SMTPAccount":                        "login@example.com",
		"SMTPFromAliases":                    "Campaigns@Example.com,alerts@example.com",
		"recall_campaign_setting.email_from": "Campaigns@Example.com",
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.email_from": "Campaigns@Example.com",
	}))

	require.NoError(t, UpdateOption("SMTPFrom", "campaigns@example.com"))

	require.Equal(t, "campaigns@example.com", persistedOptionValue(t, "SMTPFrom"))
	require.Equal(t, "campaigns@example.com", common.SMTPFrom)
	require.Equal(t, "campaigns@example.com", common.OptionMap["SMTPFrom"])
	require.Equal(t, "Campaigns@Example.com", operation_setting.GetRecallCampaignSetting().EmailFrom)
}

func TestUpdateOptionRecallSenderUsesDBAliasesNotStaleMemory(t *testing.T) {
	setupRecallSenderOptionTest(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "login@example.com"
	common.SMTPFromAliases = "Campaigns@Example.com,alerts@example.com"
	common.OptionMap["SMTPFromAliases"] = "Campaigns@Example.com,alerts@example.com"
	seedRecallSenderOptions(t, map[string]string{
		"SMTPFrom":                           "system@example.com",
		"SMTPAccount":                        "login@example.com",
		"SMTPFromAliases":                    "alerts@example.com",
		"recall_campaign_setting.email_from": "",
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.email_from": "",
	}))

	err := UpdateOption("recall_campaign_setting.email_from", "campaigns@example.com")

	require.ErrorContains(t, err, "Activity sender must be one of the configured SMTP aliases")
	require.Equal(t, "", persistedOptionValue(t, "recall_campaign_setting.email_from"))
	require.Equal(t, "alerts@example.com", persistedOptionValue(t, "SMTPFromAliases"))
	require.Equal(t, "Campaigns@Example.com,alerts@example.com", common.SMTPFromAliases)
	require.Equal(t, "Campaigns@Example.com,alerts@example.com", common.OptionMap["SMTPFromAliases"])
	require.Empty(t, operation_setting.GetRecallCampaignSetting().EmailFrom)
}

func TestUpdateOptionSMTPFromAliasesUsesDBRecallSenderNotStaleMemory(t *testing.T) {
	setupRecallSenderOptionTest(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "login@example.com"
	common.SMTPFromAliases = "Campaigns@Example.com,alerts@example.com"
	common.OptionMap["SMTPFromAliases"] = "Campaigns@Example.com,alerts@example.com"
	seedRecallSenderOptions(t, map[string]string{
		"SMTPFrom":                           "system@example.com",
		"SMTPAccount":                        "login@example.com",
		"SMTPFromAliases":                    "Campaigns@Example.com,alerts@example.com",
		"recall_campaign_setting.email_from": "Campaigns@Example.com",
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.email_from": "",
	}))

	err := UpdateOption("SMTPFromAliases", "alerts@example.com")

	require.ErrorContains(t, err, "currently selected")
	require.Equal(t, "Campaigns@Example.com,alerts@example.com", persistedOptionValue(t, "SMTPFromAliases"))
	require.Equal(t, "Campaigns@Example.com", persistedOptionValue(t, "recall_campaign_setting.email_from"))
	require.Equal(t, "Campaigns@Example.com,alerts@example.com", common.SMTPFromAliases)
	require.Equal(t, "Campaigns@Example.com,alerts@example.com", common.OptionMap["SMTPFromAliases"])
	require.Empty(t, operation_setting.GetRecallCampaignSetting().EmailFrom)
}

func TestUpdateOptionSMTPFromAliasesNoopConvergesStaleRuntimeToDB(t *testing.T) {
	setupRecallSenderOptionTest(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "login@example.com"
	common.SMTPFromAliases = "Campaigns@Example.com"
	common.OptionMap["SMTPFromAliases"] = "Campaigns@Example.com"
	seedRecallSenderOptions(t, map[string]string{
		"SMTPFrom":                           "system@example.com",
		"SMTPAccount":                        "login@example.com",
		"SMTPFromAliases":                    "alerts@example.com",
		"recall_campaign_setting.email_from": "",
	})

	require.NoError(t, UpdateOption("SMTPFromAliases", "alerts@example.com"))

	require.Equal(t, "alerts@example.com", persistedOptionValue(t, "SMTPFromAliases"))
	require.Equal(t, "alerts@example.com", common.SMTPFromAliases)
	require.Equal(t, "alerts@example.com", common.OptionMap["SMTPFromAliases"])
}

func TestUpdateOptionSMTPFromAliasesDBWriteFailureDoesNotApplyRuntime(t *testing.T) {
	setupRecallSenderOptionTest(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "login@example.com"
	common.SMTPFromAliases = "Campaigns@Example.com"
	common.OptionMap["SMTPFromAliases"] = "Campaigns@Example.com"
	require.NoError(t, DB.Migrator().DropTable(&Option{}))

	err := UpdateOption("SMTPFromAliases", "alerts@example.com")

	require.Error(t, err)
	require.Equal(t, "Campaigns@Example.com", common.SMTPFromAliases)
	require.Equal(t, "Campaigns@Example.com", common.OptionMap["SMTPFromAliases"])
}

func TestUpdateOptionsBulkRejectsRecallSenderOptions(t *testing.T) {
	setupRecallSenderOptionTest(t)

	err := UpdateOptionsBulk(map[string]string{
		"SMTPFromAliases": "alerts@example.com",
	})

	require.ErrorContains(t, err, "recall sender options must be updated individually")
	require.NotContains(t, common.OptionMap, "SMTPFromAliases")
}

func TestUpdateOptionRecallSenderFailedValidationLeavesDBAndRuntimeUnchanged(t *testing.T) {
	setupRecallSenderOptionTest(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "login@example.com"
	common.SMTPFromAliases = "Campaigns@Example.com,alerts@example.com"
	seedRecallSenderOptions(t, map[string]string{
		"SMTPFrom":                           "system@example.com",
		"SMTPAccount":                        "login@example.com",
		"SMTPFromAliases":                    "Campaigns@Example.com,alerts@example.com",
		"recall_campaign_setting.email_from": "Campaigns@Example.com",
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.email_from": "Campaigns@Example.com",
	}))

	err := UpdateOption("recall_campaign_setting.email_from", "system@example.com")

	require.ErrorContains(t, err, "Activity sender must be one of the configured SMTP aliases")
	require.Equal(t, "Campaigns@Example.com", persistedOptionValue(t, "recall_campaign_setting.email_from"))
	require.Equal(t, "Campaigns@Example.com", operation_setting.GetRecallCampaignSetting().EmailFrom)
	require.Equal(t, "Campaigns@Example.com,alerts@example.com", common.SMTPFromAliases)
}

func TestUpdateOptionSMTPFromAliasesFailedValidationLeavesDBAndRuntimeUnchanged(t *testing.T) {
	setupRecallSenderOptionTest(t)
	common.SMTPFrom = "system@example.com"
	common.SMTPAccount = "login@example.com"
	common.SMTPFromAliases = "Campaigns@Example.com,alerts@example.com"
	common.OptionMap["SMTPFromAliases"] = "Campaigns@Example.com,alerts@example.com"
	require.NoError(t, DB.Create(&Option{Key: "SMTPFromAliases", Value: "Campaigns@Example.com,alerts@example.com"}).Error)

	err := UpdateOption("SMTPFromAliases", "safe@example.com\nBcc: victim@example.com")

	require.Error(t, err)
	require.True(t, strings.Contains(err.Error(), "invalid SMTP from alias") || strings.Contains(err.Error(), "invalid SMTP account"))
	require.Equal(t, "Campaigns@Example.com,alerts@example.com", persistedOptionValue(t, "SMTPFromAliases"))
	require.Equal(t, "Campaigns@Example.com,alerts@example.com", common.SMTPFromAliases)
	require.Equal(t, "Campaigns@Example.com,alerts@example.com", common.OptionMap["SMTPFromAliases"])
}
