package model

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetChannelExcludingSkipsPreviouslyFailedChannel(t *testing.T) {
	originalDB := DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
	DB = db
	t.Cleanup(func() {
		DB = originalDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		if sqlDB, dbErr := db.DB(); dbErr == nil {
			_ = sqlDB.Close()
		}
	})

	priority := int64(100)
	require.NoError(t, db.Create(&Channel{Id: 1, Name: "depleted"}).Error)
	require.NoError(t, db.Create(&Channel{Id: 2, Name: "available"}).Error)
	require.NoError(t, db.Create(&Ability{
		Group: "default", Model: "gpt-test", ChannelId: 1,
		Enabled: true, Priority: &priority, Weight: 100,
	}).Error)
	require.NoError(t, db.Create(&Ability{
		Group: "default", Model: "gpt-test", ChannelId: 2,
		Enabled: true, Priority: &priority, Weight: 1,
	}).Error)

	channel, err := GetChannelExcluding(
		"default",
		"gpt-test",
		0,
		"/v1/chat/completions",
		map[int]struct{}{1: {}},
	)
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 2, channel.Id)
}
