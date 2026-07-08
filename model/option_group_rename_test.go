package model

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/alicebob/miniredis/v2"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
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
	originalGroupModelRatio := ratio_setting.GroupModelRatio2JSONString()

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
		require.NoError(t, ratio_setting.UpdateGroupModelRatioByJSONString(originalGroupModelRatio))
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

func TestUpdateGroupRatioRenameSyncsGroupModelRatio(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"old-group":1,"keep":1}`))
	require.NoError(t, UpdateOption("GroupModelRatio", `{"old-group":{"gpt-5.5":0.3},"keep":{"gpt-4o":0.8}}`))

	require.NoError(t, updateOptionMap("GroupRatio", `{"new-group":1,"keep":1}`))

	_, oldExists, _ := ratio_setting.GetGroupModelRatio("old-group", "gpt-5.5")
	require.False(t, oldExists)

	ratio, ok, matchedModel := ratio_setting.GetGroupModelRatio("new-group", "gpt-5.5")
	require.True(t, ok)
	require.Equal(t, 0.3, ratio)
	require.Equal(t, "gpt-5.5", matchedModel)

	var option Option
	require.NoError(t, DB.Where("key = ?", "GroupModelRatio").First(&option).Error)
	require.JSONEq(t, `{"new-group":{"gpt-5.5":0.3},"keep":{"gpt-4o":0.8}}`, option.Value)
	require.JSONEq(t, option.Value, common.OptionMap["GroupModelRatio"])
}

func TestUpdateOptionPersistsGroupModelRatio(t *testing.T) {
	setupOptionGroupRenameTestDB(t)

	require.NoError(t, UpdateOption("GroupModelRatio", `{"plg":{"gpt-5.5":0.3}}`))

	var option Option
	require.NoError(t, DB.Where("key = ?", "GroupModelRatio").First(&option).Error)
	require.Equal(t, `{"plg":{"gpt-5.5":0.3}}`, option.Value)
	require.Equal(t, `{"plg":{"gpt-5.5":0.3}}`, common.OptionMap["GroupModelRatio"])

	ratio, ok, matchedModel := ratio_setting.GetGroupModelRatio("plg", "gpt-5.5")
	require.True(t, ok)
	require.Equal(t, 0.3, ratio)
	require.Equal(t, "gpt-5.5", matchedModel)
}

func TestUpdateOptionPersistsNestedGroupModelRatioConfig(t *testing.T) {
	setupOptionGroupRenameTestDB(t)

	ratio_setting.InvalidateExposedDataCache()
	require.NoError(t, UpdateOption("group_ratio_setting.group_model_ratio", `{"plg":{"gpt-5.5":0.3}}`))

	var option Option
	require.NoError(t, DB.Where("key = ?", "group_ratio_setting.group_model_ratio").First(&option).Error)
	require.Equal(t, `{"plg":{"gpt-5.5":0.3}}`, option.Value)
	require.Equal(t, `{"plg":{"gpt-5.5":0.3}}`, common.OptionMap["group_ratio_setting.group_model_ratio"])

	ratio, ok, matchedModel := ratio_setting.GetGroupModelRatio("plg", "gpt-5.5")
	require.True(t, ok)
	require.Equal(t, 0.3, ratio)
	require.Equal(t, "gpt-5.5", matchedModel)

	exposed := ratio_setting.GetExposedData()
	groupModelRatio, ok := exposed["group_model_ratio"].(map[string]map[string]float64)
	require.True(t, ok)
	require.Equal(t, 0.3, groupModelRatio["plg"]["gpt-5.5"])
}

func TestUpdateOptionRejectsInvalidGroupModelRatioBeforePersisting(t *testing.T) {
	setupOptionGroupRenameTestDB(t)

	err := UpdateOption("GroupModelRatio", `{"plg":{"gpt-5.5":-0.1}}`)
	require.Error(t, err)

	var persistedCount int64
	require.NoError(t, DB.Model(&Option{}).Where("key = ?", "GroupModelRatio").Count(&persistedCount).Error)
	require.Zero(t, persistedCount)
	require.Equal(t, `{}`, ratio_setting.GroupModelRatio2JSONString())
}

func TestLoadOptionsFromDatabaseInvalidatesPricingCache(t *testing.T) {
	setupOptionGroupRenameTestDB(t)

	pricingMap = []Pricing{{ModelName: "cached"}}
	vendorsList = []PricingVendor{{ID: 1, Name: "cached"}}
	lastGetPricingTime = time.Now()

	LoadOptionsFromDatabase()

	require.Nil(t, pricingMap)
	require.Nil(t, vendorsList)
	require.True(t, lastGetPricingTime.IsZero())
}

func TestUpdateOptionValidatesAmountBonusConfigBeforePersisting(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	paymentSetting := operation_setting.GetPaymentSetting()
	originalBonus := paymentSetting.AmountBonus
	t.Cleanup(func() {
		paymentSetting.AmountBonus = originalBonus
	})
	paymentSetting.AmountBonus = map[int]int64{20: 5}

	err := UpdateOption("payment_setting.amount_bonus", `{"20":"5"}`)
	require.Error(t, err)

	var persistedCount int64
	require.NoError(t, DB.Model(&Option{}).Where("key = ?", "payment_setting.amount_bonus").Count(&persistedCount).Error)
	require.Zero(t, persistedCount)
	require.Equal(t, map[int]int64{20: 5}, paymentSetting.AmountBonus)
}

func TestUpdateOptionNormalizesEmptyAmountBonusConfigToEmptyObject(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	paymentSetting := operation_setting.GetPaymentSetting()
	originalBonus := paymentSetting.AmountBonus
	t.Cleanup(func() {
		paymentSetting.AmountBonus = originalBonus
	})
	paymentSetting.AmountBonus = map[int]int64{20: 5}

	require.NoError(t, UpdateOption("payment_setting.amount_bonus", ""))

	var option Option
	require.NoError(t, DB.Where("key = ?", "payment_setting.amount_bonus").First(&option).Error)
	require.Equal(t, "{}", option.Value)
	require.Empty(t, paymentSetting.AmountBonus)
}

func TestUpdateOptionsBulkRejectsInvalidAmountBonusConfig(t *testing.T) {
	setupOptionGroupRenameTestDB(t)

	err := UpdateOptionsBulk(map[string]string{
		"payment_setting.amount_bonus": `{"20":0}`,
	})
	require.Error(t, err)

	var persistedCount int64
	require.NoError(t, DB.Model(&Option{}).Where("key = ?", "payment_setting.amount_bonus").Count(&persistedCount).Error)
	require.Zero(t, persistedCount)
}

func TestUpdateOptionsBulkPublishesOptionsChange(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	mr := miniredis.RunT(t)
	previousRDB := common.RDB
	previousRedisEnabled := common.RedisEnabled
	common.RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	common.RedisEnabled = true
	t.Cleanup(func() {
		require.NoError(t, common.RDB.Close())
		common.RDB = previousRDB
		common.RedisEnabled = previousRedisEnabled
	})

	ctx := context.Background()
	sub := common.RDB.Subscribe(ctx, common.ConfigChangedChannel)
	defer sub.Close()
	_, err := sub.Receive(ctx)
	require.NoError(t, err)
	ch := sub.Channel()

	require.NoError(t, UpdateOptionsBulk(map[string]string{
		"PlaygroundDefaultModel": "gpt-4o-mini",
	}))

	select {
	case msg := <-ch:
		require.Equal(t, common.ConfigChangedChannel, msg.Channel)
		require.True(t, strings.Contains(msg.Payload, `"scope":"options"`), msg.Payload)
	case <-time.After(2 * time.Second):
		t.Fatal("expected options change pubsub message")
	}
}

func TestUpdateOptionValidatesAmountBonusLimitConfig(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	// 非法：次数为负
	err := UpdateOption("payment_setting.amount_bonus_limit", `{"20":-1}`)
	require.Error(t, err)

	var persistedCount int64
	require.NoError(t, DB.Model(&Option{}).Where("key = ?", "payment_setting.amount_bonus_limit").Count(&persistedCount).Error)
	require.Zero(t, persistedCount)
}

func TestUpdateOptionNormalizesEmptyAmountBonusLimitToEmptyObject(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	require.NoError(t, UpdateOption("payment_setting.amount_bonus_limit", ""))

	var option Option
	require.NoError(t, DB.Where("key = ?", "payment_setting.amount_bonus_limit").First(&option).Error)
	require.Equal(t, "{}", option.Value)
}

func TestUpdateOptionAcceptsValidAmountBonusLimitConfig(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	require.NoError(t, UpdateOption("payment_setting.amount_bonus_limit", `{"20":2}`))

	var option Option
	require.NoError(t, DB.Where("key = ?", "payment_setting.amount_bonus_limit").First(&option).Error)
	require.Equal(t, `{"20":2}`, option.Value)
}
