package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupOptionGroupRenameTestDB(t *testing.T) {
	t.Helper()

	originalDB := DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalCommonGroupCol := commonGroupCol
	originalGroupRatio := ratio_setting.GroupRatio2JSONString()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}, &Option{}))

	DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	commonGroupCol = "`group`"
	common.OptionMap = make(map[string]string)

	t.Cleanup(func() {
		DB = originalDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		commonGroupCol = originalCommonGroupCol
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatio))
	})
}

func TestUpdateGroupRatioRenameSyncsChannelGroupsAndAbilities(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"old-group":1,"keep":1}`))

	channel := &Channel{
		Id:     1,
		Type:   1,
		Key:    "test-key",
		Name:   "test-channel",
		Status: common.ChannelStatusEnabled,
		Models: "gpt-test",
		Group:  "oldish,old-group,keep",
	}
	require.NoError(t, channel.Save())
	require.NoError(t, channel.UpdateAbilities(nil))

	require.NoError(t, updateOptionMap("GroupRatio", `{"new-group":1,"keep":1}`))

	var updated Channel
	require.NoError(t, DB.First(&updated, channel.Id).Error)
	require.Equal(t, "oldish,new-group,keep", updated.Group)

	var oldAbilityCount int64
	require.NoError(t, DB.Model(&Ability{}).Where(commonGroupCol+" = ?", "old-group").Count(&oldAbilityCount).Error)
	require.Zero(t, oldAbilityCount)

	var newAbilityCount int64
	require.NoError(t, DB.Model(&Ability{}).Where(commonGroupCol+" = ?", "new-group").Count(&newAbilityCount).Error)
	require.Equal(t, int64(1), newAbilityCount)

	var untouchedAbilityCount int64
	require.NoError(t, DB.Model(&Ability{}).Where(commonGroupCol+" = ?", "oldish").Count(&untouchedAbilityCount).Error)
	require.Equal(t, int64(1), untouchedAbilityCount)
}
