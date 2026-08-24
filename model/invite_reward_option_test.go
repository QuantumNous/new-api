package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestApplyOptionMapValueRejectsInvalidInviterRewardLimit(t *testing.T) {
	originalLimit := common.QuotaForInviterMaxCount
	originalOptionMap := common.OptionMap
	common.QuotaForInviterMaxCount = 5
	common.OptionMap = map[string]string{"QuotaForInviterMaxCount": "5"}
	t.Cleanup(func() {
		common.QuotaForInviterMaxCount = originalLimit
		common.OptionMap = originalOptionMap
	})

	err := applyOptionMapValue("QuotaForInviterMaxCount", "not-a-number")
	require.Error(t, err)
	require.Equal(t, 5, common.QuotaForInviterMaxCount)
	require.Equal(t, "5", common.OptionMap["QuotaForInviterMaxCount"])

	err = applyOptionMapValue("QuotaForInviterMaxCount", "-1")
	require.Error(t, err)
	require.Equal(t, 5, common.QuotaForInviterMaxCount)
	require.Equal(t, "5", common.OptionMap["QuotaForInviterMaxCount"])

	require.NoError(t, applyOptionMapValue("QuotaForInviterMaxCount", " 0 "))
	require.Zero(t, common.QuotaForInviterMaxCount)
	require.Equal(t, " 0 ", common.OptionMap["QuotaForInviterMaxCount"])
}

func TestUpdateOptionRejectsInvalidInviterRewardLimitBeforePersisting(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	originalLimit := common.QuotaForInviterMaxCount
	common.QuotaForInviterMaxCount = 5
	t.Cleanup(func() {
		common.QuotaForInviterMaxCount = originalLimit
	})

	require.Error(t, UpdateOption("QuotaForInviterMaxCount", "not-a-number"))
	require.Error(t, UpdateOption("QuotaForInviterMaxCount", "-1"))

	var persistedCount int64
	require.NoError(t, DB.Model(&Option{}).Where("key = ?", "QuotaForInviterMaxCount").Count(&persistedCount).Error)
	require.Zero(t, persistedCount)
	require.Equal(t, 5, common.QuotaForInviterMaxCount)
	require.NotContains(t, common.OptionMap, "QuotaForInviterMaxCount")
}

func TestUpdateOptionsBulkRejectsInvalidInviterRewardLimitWithoutPartialWrite(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	originalLimit := common.QuotaForInviterMaxCount
	common.QuotaForInviterMaxCount = 5
	t.Cleanup(func() {
		common.QuotaForInviterMaxCount = originalLimit
	})

	err := UpdateOptionsBulk(map[string]string{
		"QuotaForInviterMaxCount": "-1",
		"SidebarModulesAdmin":     `{"chat":{"enabled":true}}`,
	})
	require.Error(t, err)

	var persistedCount int64
	require.NoError(t, DB.Model(&Option{}).Where("key IN ?", []string{"QuotaForInviterMaxCount", "SidebarModulesAdmin"}).Count(&persistedCount).Error)
	require.Zero(t, persistedCount)
	require.Equal(t, 5, common.QuotaForInviterMaxCount)
	require.NotContains(t, common.OptionMap, "QuotaForInviterMaxCount")
	require.NotContains(t, common.OptionMap, "SidebarModulesAdmin")
}

func TestUpdateOptionNormalizesInviterRewardLimitBeforePersisting(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	originalLimit := common.QuotaForInviterMaxCount
	common.QuotaForInviterMaxCount = 5
	t.Cleanup(func() {
		common.QuotaForInviterMaxCount = originalLimit
	})

	require.NoError(t, UpdateOption("QuotaForInviterMaxCount", " 0 "))

	var option Option
	require.NoError(t, DB.Where("key = ?", "QuotaForInviterMaxCount").First(&option).Error)
	require.Equal(t, "0", option.Value)
	require.Zero(t, common.QuotaForInviterMaxCount)
	require.Equal(t, "0", common.OptionMap["QuotaForInviterMaxCount"])
}

func TestUpdateOptionRejectsRetiredInviteRewardUnlockDelay(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	originalDelay := common.InviteRewardUnlockDelaySeconds
	common.InviteRewardUnlockDelaySeconds = 604800
	t.Cleanup(func() {
		common.InviteRewardUnlockDelaySeconds = originalDelay
	})

	err := UpdateOption("InviteRewardUnlockDelaySeconds", "1")

	require.Error(t, err)
	require.ErrorContains(t, err, "retired")
	var persistedCount int64
	require.NoError(t, DB.Model(&Option{}).Where("key = ?", "InviteRewardUnlockDelaySeconds").Count(&persistedCount).Error)
	require.Zero(t, persistedCount)
	require.EqualValues(t, 604800, common.InviteRewardUnlockDelaySeconds)
	require.NotContains(t, common.OptionMap, "InviteRewardUnlockDelaySeconds")
}

func TestLoadOptionsFromDatabaseIgnoresRetiredInviteRewardUnlockDelay(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	originalDelay := common.InviteRewardUnlockDelaySeconds
	common.InviteRewardUnlockDelaySeconds = 604800
	t.Cleanup(func() {
		common.InviteRewardUnlockDelaySeconds = originalDelay
	})
	require.NoError(t, DB.Create(&Option{Key: "InviteRewardUnlockDelaySeconds", Value: "1"}).Error)
	common.OptionMap["InviteRewardUnlockDelaySeconds"] = "604800"

	LoadOptionsFromDatabase()

	require.EqualValues(t, 604800, common.InviteRewardUnlockDelaySeconds)
	require.NotContains(t, common.OptionMap, "InviteRewardUnlockDelaySeconds")
	var option Option
	require.NoError(t, DB.Where("key = ?", "InviteRewardUnlockDelaySeconds").First(&option).Error)
	require.Equal(t, "1", option.Value)
}
