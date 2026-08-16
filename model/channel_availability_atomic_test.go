package model

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func useChannelAvailabilityTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))

	originalDB := DB
	originalDatabaseType := common.MainDatabaseType()
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		DB = originalDB
		common.SetMainDatabaseType(originalDatabaseType)
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
	})
	return db
}

func newMultiKeyChannel(id int, status int, key string, keyStatuses map[int]int) Channel {
	tag := "multi-key"
	return Channel{
		Id:     id,
		Type:   1,
		Key:    key,
		Status: status,
		Name:   "multi-key-channel",
		Models: "gpt-4",
		Group:  "default",
		Tag:    &tag,
		ChannelInfo: ChannelInfo{
			IsMultiKey:         true,
			MultiKeyStatusList: keyStatuses,
		},
	}
}

func TestBatchInsertChannelsNormalizesMultiKeyAvailability(t *testing.T) {
	useChannelAvailabilityTestDB(t)
	channels := []Channel{
		newMultiKeyChannel(1, common.ChannelStatusEnabled, "disabled-key", map[int]int{0: common.ChannelStatusManuallyDisabled}),
		newMultiKeyChannel(2, common.ChannelStatusManuallyDisabled, "disabled-key", map[int]int{0: common.ChannelStatusManuallyDisabled}),
	}

	require.NoError(t, BatchInsertChannels(channels))

	var persisted []Channel
	require.NoError(t, DB.Order("id ASC").Find(&persisted).Error)
	require.Len(t, persisted, 2)
	assert.Equal(t, common.ChannelStatusAutoDisabled, persisted[0].Status)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, persisted[1].Status)
	var abilities []Ability
	require.NoError(t, DB.Order("channel_id ASC").Find(&abilities).Error)
	require.Len(t, abilities, 2)
	assert.False(t, abilities[0].Enabled)
	assert.False(t, abilities[1].Enabled)
}

func TestEnableChannelByTagKeepsChannelDisabledWithoutUsableKey(t *testing.T) {
	useChannelAvailabilityTestDB(t)
	channel := newMultiKeyChannel(1, common.ChannelStatusManuallyDisabled, "disabled-key", map[int]int{0: common.ChannelStatusManuallyDisabled})
	require.NoError(t, channel.Insert())

	require.NoError(t, EnableChannelByTag(channel.GetTag()))

	var persisted Channel
	require.NoError(t, DB.First(&persisted, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, persisted.Status)
	var ability Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
	assert.False(t, ability.Enabled)
}

func TestInitChannelCacheBuildsRoutesFromChannelSnapshot(t *testing.T) {
	useChannelAvailabilityTestDB(t)
	common.MemoryCacheEnabled = true

	channelSyncLock.Lock()
	originalGroupRoutes := group2model2channels
	originalChannels := channelsIDM
	originalAdvancedCustom := channel2advancedCustomConfig
	originalGeneration := channelCacheGeneration
	channelSyncLock.Unlock()
	t.Cleanup(func() {
		channelSyncLock.Lock()
		group2model2channels = originalGroupRoutes
		channelsIDM = originalChannels
		channel2advancedCustomConfig = originalAdvancedCustom
		channelCacheGeneration = originalGeneration
		channelSyncLock.Unlock()
	})

	channel := Channel{
		Name:   "cache-snapshot-channel",
		Type:   1,
		Key:    "key",
		Status: common.ChannelStatusEnabled,
		Models: "gpt-4",
		Group:  "default",
	}
	require.NoError(t, DB.Create(&channel).Error)
	require.NotPanics(t, InitChannelCache)

	channelSyncLock.RLock()
	routes := append([]int(nil), group2model2channels["default"]["gpt-4"]...)
	channelSyncLock.RUnlock()
	assert.Equal(t, []int{channel.Id}, routes)
}

func TestChannelUpdateReplacesDisabledKeyStateByKeyIdentity(t *testing.T) {
	useChannelAvailabilityTestDB(t)
	channel := newMultiKeyChannel(1, common.ChannelStatusEnabled, "old-key", map[int]int{0: common.ChannelStatusManuallyDisabled})
	require.NoError(t, channel.Insert())
	require.NoError(t, DB.First(&channel, channel.Id).Error)
	require.Equal(t, common.ChannelStatusAutoDisabled, channel.Status)

	channel.Key = "new-key"
	require.NoError(t, channel.Update())

	var persisted Channel
	require.NoError(t, DB.First(&persisted, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusEnabled, persisted.Status)
	assert.Empty(t, persisted.ChannelInfo.MultiKeyStatusList)
	var ability Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
	assert.True(t, ability.Enabled)
}

func TestHasEnabledMultiKeyIgnoresBlankKeys(t *testing.T) {
	assert.False(t, hasEnabledMultiKey([]string{"", "  ", "\t"}, nil))
	assert.True(t, hasEnabledMultiKey([]string{"", "usable"}, nil))
}

func TestChannelInsertRollsBackWhenAbilityCreationFails(t *testing.T) {
	db := useChannelAvailabilityTestDB(t)
	forcedErr := errors.New("forced ability create failure")
	callbackName := "test:fail-ability-create-on-insert"
	require.NoError(t, db.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "abilities" {
			tx.AddError(forcedErr)
		}
	}))
	t.Cleanup(func() { _ = db.Callback().Create().Remove(callbackName) })

	channel := newMultiKeyChannel(1, common.ChannelStatusEnabled, "key", nil)
	err := channel.Insert()
	require.ErrorIs(t, err, forcedErr)

	var channelCount int64
	require.NoError(t, DB.Model(&Channel{}).Count(&channelCount).Error)
	assert.Zero(t, channelCount)
}

func TestChannelUpdateRollsBackChannelAndAbilitiesTogether(t *testing.T) {
	db := useChannelAvailabilityTestDB(t)
	channel := newMultiKeyChannel(1, common.ChannelStatusEnabled, "key", nil)
	require.NoError(t, channel.Insert())

	forcedErr := errors.New("forced ability recreate failure")
	callbackName := "test:fail-ability-create-on-update"
	require.NoError(t, db.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "abilities" {
			tx.AddError(forcedErr)
		}
	}))
	t.Cleanup(func() { _ = db.Callback().Create().Remove(callbackName) })

	channel.Models = "claude-3"
	err := channel.Update()
	require.ErrorIs(t, err, forcedErr)

	var persisted Channel
	require.NoError(t, DB.First(&persisted, channel.Id).Error)
	assert.Equal(t, "gpt-4", persisted.Models)
	var abilities []Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).Find(&abilities).Error)
	require.Len(t, abilities, 1)
	assert.Equal(t, "gpt-4", abilities[0].Model)
}

func TestUpdateChannelStatusRollsBackWhenAbilityUpdateFails(t *testing.T) {
	db := useChannelAvailabilityTestDB(t)
	channel := newMultiKeyChannel(1, common.ChannelStatusEnabled, "key", nil)
	require.NoError(t, channel.Insert())

	forcedErr := errors.New("forced ability status failure")
	callbackName := "test:fail-ability-status-update"
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "abilities" {
			tx.AddError(forcedErr)
		}
	}))
	t.Cleanup(func() { _ = db.Callback().Update().Remove(callbackName) })

	assert.False(t, UpdateChannelStatus(channel.Id, "", common.ChannelStatusManuallyDisabled, "test"))
	var persisted Channel
	require.NoError(t, DB.First(&persisted, channel.Id).Error)
	assert.Equal(t, common.ChannelStatusEnabled, persisted.Status)
	var ability Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
	assert.True(t, ability.Enabled)
}

func TestFixAbilityRollsBackAtomicRebuildOnFailure(t *testing.T) {
	db := useChannelAvailabilityTestDB(t)
	channel := newMultiKeyChannel(1, common.ChannelStatusEnabled, "key", nil)
	require.NoError(t, channel.Insert())

	forcedErr := errors.New("forced ability rebuild failure")
	callbackName := "test:fail-ability-create-on-rebuild"
	require.NoError(t, db.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "abilities" {
			tx.AddError(forcedErr)
		}
	}))
	t.Cleanup(func() { _ = db.Callback().Create().Remove(callbackName) })

	_, _, err := FixAbility()
	require.ErrorIs(t, err, forcedErr)
	var abilities []Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).Find(&abilities).Error)
	require.Len(t, abilities, 1)
	assert.Equal(t, "gpt-4", abilities[0].Model)
}
