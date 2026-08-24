package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/require"
)

func setupRegistrationSecurityOptionTest(t *testing.T) {
	t.Helper()
	setupOptionGroupRenameTestDB(t)
	require.NoError(t, DB.AutoMigrate(&RegistrationDomainState{}, &RegistrationDomainBlock{}, &RegistrationDomainBlockUser{}))
	original := config.GlobalConfig.ExportAllConfigs()
	saved := map[string]string{}
	for key, value := range original {
		if len(key) > len("registration_security.") && key[:len("registration_security.")] == "registration_security." {
			saved[key] = value
		}
	}
	t.Cleanup(func() { require.NoError(t, config.GlobalConfig.LoadFromDB(saved)) })
}

func TestUpdateOptionsBulkRejectsInvalidRegistrationSecurityWithoutPartialSave(t *testing.T) {
	setupRegistrationSecurityOptionTest(t)

	err := UpdateOptionsBulk(map[string]string{
		"registration_security.domain_risk_window_hours": "24",
		"registration_security.domain_risk_threshold":    "1",
	})

	require.Error(t, err)
	var count int64
	require.NoError(t, DB.Model(&Option{}).Where("key LIKE ?", "registration_security.%").Count(&count).Error)
	require.Zero(t, count)
}

func TestUpdateOptionNormalizesTrustedRegistrationDomains(t *testing.T) {
	setupRegistrationSecurityOptionTest(t)

	require.NoError(t, UpdateOption("registration_security.trusted_email_domains", `[" Example.com ","EXAMPLE.com","example.org"]`))

	var option Option
	require.NoError(t, DB.First(&option, "key = ?", "registration_security.trusted_email_domains").Error)
	require.JSONEq(t, `["example.com","example.org"]`, option.Value)
}

func TestUpdateOptionRejectsTrustingActivelyBlockedRegistrationDomain(t *testing.T) {
	setupRegistrationSecurityOptionTest(t)
	block := RegistrationDomainBlock{Domain: "blocked.example", WindowHours: 24, Threshold: 10, ObservedCount: 10, BlockedAt: 100}
	require.NoError(t, DB.Create(&block).Error)
	require.NoError(t, DB.Create(&RegistrationDomainState{Domain: block.Domain, ActiveBlockID: block.Id}).Error)

	err := UpdateOption("registration_security.trusted_email_domains", `["blocked.example"]`)

	require.Error(t, err)
	var count int64
	require.NoError(t, DB.Model(&Option{}).Where("key = ?", "registration_security.trusted_email_domains").Count(&count).Error)
	require.Zero(t, count)
	require.NotContains(t, common.OptionMap, "registration_security.trusted_email_domains")
}

func TestApplyOptionMapValuesStillAppliesUnrelatedOptionsWhenRegistrationConfigIsInvalid(t *testing.T) {
	setupRegistrationSecurityOptionTest(t)
	originalOptionMap := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = originalOptionMap })

	err := applyOptionMapValues(map[string]string{
		"registration_security.domain_risk_threshold": "1",
		"ocr_unrelated_option":                        "preserved",
	})

	require.Error(t, err)
	require.Equal(t, "preserved", common.OptionMap["ocr_unrelated_option"])
}

func TestApplyOptionMapValueRestoresPreviousValueWhenTypedConfigRejectsUpdate(t *testing.T) {
	setupRegistrationSecurityOptionTest(t)
	originalOptionMap := common.OptionMap
	common.OptionMap = map[string]string{"registration_security.domain_risk_threshold": "10"}
	t.Cleanup(func() { common.OptionMap = originalOptionMap })

	err := applyOptionMapValue("registration_security.domain_risk_threshold", "1")

	require.Error(t, err)
	require.Equal(t, "10", common.OptionMap["registration_security.domain_risk_threshold"])
}

func TestApplyOptionMapValueRestoresPreviousValueWhenLegacyHandlerRejectsUpdate(t *testing.T) {
	setupRegistrationSecurityOptionTest(t)
	originalOptionMap := common.OptionMap
	originalChats := setting.Chats
	expectedChats := []map[string]string{{"existing": "https://example.com"}}
	setting.Chats = expectedChats
	common.OptionMap = map[string]string{"Chats": `[{"existing":"https://example.com"}]`}
	t.Cleanup(func() {
		common.OptionMap = originalOptionMap
		setting.Chats = originalChats
	})

	err := applyOptionMapValue("Chats", "{")

	require.Error(t, err)
	require.Equal(t, `[{"existing":"https://example.com"}]`, common.OptionMap["Chats"])
	require.Equal(t, expectedChats, setting.Chats)
}
