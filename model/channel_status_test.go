package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelStatusTestDB(t *testing.T) {
	t.Helper()

	originalDB := DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalMemoryCacheEnabled := common.MemoryCacheEnabled

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/channel-status.db?_pragma=busy_timeout(5000)"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))

	DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.MemoryCacheEnabled = false

	t.Cleanup(func() {
		DB = originalDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		require.NoError(t, sqlDB.Close())
	})
}

func insertChannelStatusTestChannel(t *testing.T, channelType int, status int) Channel {
	t.Helper()

	channel := Channel{
		Type:   channelType,
		Key:    `{"access_token":"at"}`,
		Name:   "status-test",
		Status: status,
		Models: "gpt-5-codex",
		Group:  "default",
	}
	require.NoError(t, DB.Create(&channel).Error)
	return channel
}

func TestUpdateChannelStatusDoesNotOverwriteBanned(t *testing.T) {
	setupChannelStatusTestDB(t)
	channel := insertChannelStatusTestChannel(t, 1, common.ChannelStatusBanned)

	require.False(t, UpdateChannelStatus(channel.Id, "", common.ChannelStatusAutoDisabled, "upstream failure"))

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	require.Equal(t, common.ChannelStatusBanned, stored.Status)
}

func TestUpdateChannelStatusDoesNotRestoreBannedAutomatically(t *testing.T) {
	setupChannelStatusTestDB(t)
	channel := insertChannelStatusTestChannel(t, 3, common.ChannelStatusBanned)

	require.False(t, UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, "automatic recovery"))

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	require.Equal(t, common.ChannelStatusBanned, stored.Status)
}

func TestUpdateChannelStatusDoesNotOverwriteBannedInMemoryCache(t *testing.T) {
	setupChannelStatusTestDB(t)
	channel := insertChannelStatusTestChannel(t, 1, common.ChannelStatusBanned)

	common.MemoryCacheEnabled = true
	InitChannelCache()
	require.False(t, UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, "automatic recovery"))

	cached, err := CacheGetChannel(channel.Id)
	require.NoError(t, err)
	require.Equal(t, common.ChannelStatusBanned, cached.Status)
}

func TestUpdateChannelStatusCannotSetBannedAutomatically(t *testing.T) {
	setupChannelStatusTestDB(t)
	channel := insertChannelStatusTestChannel(t, 2, common.ChannelStatusEnabled)

	require.False(t, UpdateChannelStatus(channel.Id, "", common.ChannelStatusBanned, "upstream failure"))

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	require.Equal(t, common.ChannelStatusEnabled, stored.Status)
}

func TestMultiKeyAutomaticDisableDoesNotOverwriteBanned(t *testing.T) {
	channel := Channel{
		Status: common.ChannelStatusBanned,
		Key:    `["key-a","key-b"]`,
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
		},
	}

	handlerMultiKeyUpdate(&channel, "key-a", common.ChannelStatusAutoDisabled, "upstream failure")

	require.Equal(t, common.ChannelStatusBanned, channel.Status)
	require.Empty(t, channel.ChannelInfo.MultiKeyStatusList)
}

func TestMultiKeyAutomaticUpdateCannotSetBanned(t *testing.T) {
	channel := Channel{
		Status: common.ChannelStatusEnabled,
		Key:    `["key-a","key-b"]`,
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
		},
	}

	handlerMultiKeyUpdate(&channel, "key-a", common.ChannelStatusBanned, "upstream ban")

	require.Equal(t, common.ChannelStatusEnabled, channel.Status)
	require.Empty(t, channel.ChannelInfo.MultiKeyStatusList)
}
