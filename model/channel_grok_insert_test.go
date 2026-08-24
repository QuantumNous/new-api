package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupGrokChannelInsertTestDB(t *testing.T, migrateState bool) {
	t.Helper()
	originalDB := DB
	originalSQLite := common.UsingSQLite
	common.UsingSQLite = true
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/grok-channel-insert.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
	if migrateState {
		require.NoError(t, db.AutoMigrate(&GrokChannelState{}))
	}
	DB = db
	t.Cleanup(func() {
		DB = originalDB
		common.UsingSQLite = originalSQLite
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
}

func TestBatchInsertChannelsCreatesGrokStateAndAbilities(t *testing.T) {
	setupGrokChannelInsertTestDB(t, true)
	channels := []Channel{
		{Type: constant.ChannelTypeGrokSubscription, Name: "active", Key: `{"version":1,"type":"grok_subscription","access_token":"at","token_type":"Bearer","expires_at":1786900000}`, Models: "grok-4", Group: "default", Status: common.ChannelStatusEnabled},
		{Type: constant.ChannelTypeGrokSubscription, Name: "pending", Key: "", Models: "grok-4", Group: "default", Status: common.ChannelStatusEnabled},
	}
	require.NoError(t, BatchInsertChannels(channels))
	var stored []Channel
	require.NoError(t, DB.Order("id ASC").Find(&stored).Error)
	require.Len(t, stored, 2)
	activeState, err := GetGrokChannelState(stored[0].Id)
	require.NoError(t, err)
	require.Equal(t, GrokAuthStatusActive, activeState.AuthStatus)
	pendingState, err := GetGrokChannelState(stored[1].Id)
	require.NoError(t, err)
	require.Equal(t, GrokAuthStatusPending, pendingState.AuthStatus)
	var activeAbility, pendingAbility Ability
	require.NoError(t, DB.First(&activeAbility, "channel_id = ?", stored[0].Id).Error)
	require.NoError(t, DB.First(&pendingAbility, "channel_id = ?", stored[1].Id).Error)
	require.True(t, activeAbility.Enabled)
	require.False(t, pendingAbility.Enabled)
}

func TestBatchInsertChannelsRollsBackWhenGrokStateInsertFails(t *testing.T) {
	setupGrokChannelInsertTestDB(t, false)
	err := BatchInsertChannels([]Channel{{
		Type: constant.ChannelTypeGrokSubscription, Name: "rollback", Key: "",
		Models: "grok-4", Group: "default", Status: common.ChannelStatusEnabled,
	}})
	require.Error(t, err)
	var channels, abilities int64
	require.NoError(t, DB.Model(&Channel{}).Count(&channels).Error)
	require.NoError(t, DB.Model(&Ability{}).Count(&abilities).Error)
	require.Zero(t, channels)
	require.Zero(t, abilities)
}
