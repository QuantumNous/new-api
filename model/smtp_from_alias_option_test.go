package model

import (
	"bytes"
	"log"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
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

func TestLoadRecallSenderOptionStateForUpdateQuotesKeyForMySQL(t *testing.T) {
	sqliteDB, err := gorm.Open(sqlite.Open(t.TempDir()+"/recall-sender-mysql-dry-run.db"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := sqliteDB.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })

	var sqlLog bytes.Buffer
	mysqlDB, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      sqlDB,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{
		DryRun:               true,
		DisableAutomaticPing: true,
		Logger: logger.New(log.New(&sqlLog, "", 0), logger.Config{
			LogLevel: logger.Info,
		}),
	})
	require.NoError(t, err)

	originalKeyCol := commonKeyCol
	commonKeyCol = "`key`"
	t.Cleanup(func() { commonKeyCol = originalKeyCol })

	_, err = loadRecallSenderOptionStateForUpdate(mysqlDB)
	require.NoError(t, err)
	queries := sqlLog.String()
	require.Contains(t, queries, "WHERE `key` IN")
	require.NotContains(t, queries, "WHERE key IN")
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

func TestUpdateOptionSMTPFromAliasesNoLongerDependsOnActivitySender(t *testing.T) {
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

	require.NoError(t, UpdateOption("SMTPFromAliases", "alerts@example.com"))

	require.Equal(t, "alerts@example.com", persistedOptionValue(t, "SMTPFromAliases"))
	require.Equal(t, "alerts@example.com", common.SMTPFromAliases)
	require.Equal(t, "alerts@example.com", common.OptionMap["SMTPFromAliases"])
	require.Equal(t, "campaigns@example.com", persistedOptionValue(t, "recall_campaign_setting.email_from"))
}

func TestUpdateOptionSMTPFromNoLongerDependsOnActivitySender(t *testing.T) {
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

	require.NoError(t, UpdateOption("SMTPFrom", "new-default@example.com"))

	require.Equal(t, "new-default@example.com", persistedOptionValue(t, "SMTPFrom"))
	require.Equal(t, "new-default@example.com", common.SMTPFrom)
	require.Equal(t, "new-default@example.com", common.OptionMap["SMTPFrom"])
	require.Equal(t, "system@example.com", persistedOptionValue(t, "recall_campaign_setting.email_from"))
}

func TestUpdateOptionSMTPFromAliasesUsesDBAliasesNotStaleMemory(t *testing.T) {
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

	require.NoError(t, UpdateOption("SMTPFromAliases", "alerts@example.com"))

	require.Equal(t, "alerts@example.com", persistedOptionValue(t, "SMTPFromAliases"))
	require.Equal(t, "Campaigns@Example.com", persistedOptionValue(t, "recall_campaign_setting.email_from"))
	require.Equal(t, "alerts@example.com", common.SMTPFromAliases)
	require.Equal(t, "alerts@example.com", common.OptionMap["SMTPFromAliases"])
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
