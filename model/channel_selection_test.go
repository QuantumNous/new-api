package model

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetChannelFiltersAllowedTypesBeforePriority(t *testing.T) {
	originalDB := DB
	originalMainDatabaseType := common.MainDatabaseType()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	initCol()
	t.Cleanup(func() {
		DB = originalDB
		common.SetMainDatabaseType(originalMainDatabaseType)
		initCol()
		sqlDB, err := db.DB()
		if err == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	const modelName = "responses-websocket-db-selection-model"
	createChannel := func(id, channelType int, priority int64) {
		t.Helper()
		weight := uint(100)
		require.NoError(t, db.Create(&Channel{
			Id:       id,
			Type:     channelType,
			Key:      fmt.Sprintf("key-%d", id),
			Status:   common.ChannelStatusEnabled,
			Name:     fmt.Sprintf("channel-%d", id),
			Weight:   &weight,
			Models:   modelName,
			Group:    "default",
			Priority: &priority,
		}).Error)
		require.NoError(t, db.Create(&Ability{
			Group:     "default",
			Model:     modelName,
			ChannelId: id,
			Enabled:   true,
			Priority:  &priority,
			Weight:    weight,
		}).Error)
	}

	createChannel(2301, constant.ChannelTypeGemini, 100)
	createChannel(2302, constant.ChannelTypeOpenAI, 10)
	channel, err := GetChannel(
		"default",
		modelName,
		0,
		[]dto.ChannelFilter{{
			Kind:                   dto.FilterTaskPluginIdentity,
			TaskPluginChannelTypes: []int{constant.ChannelTypeOpenAI, constant.ChannelTypeCodex},
		}},
	)

	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 2302, channel.Id)
}
