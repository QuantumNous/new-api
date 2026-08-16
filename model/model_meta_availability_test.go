package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestReconcileModelChannelAvailabilityReadsAbilitiesAndChannelsInOneStatement(t *testing.T) {
	db := useChannelAvailabilityTestDB(t)
	require.NoError(t, db.AutoMigrate(&Model{}, &Option{}))

	channel := Channel{
		Id:     1,
		Type:   1,
		Key:    "key",
		Status: common.ChannelStatusEnabled,
		Name:   "channel",
		Models: "gpt-4",
		Group:  "default",
	}
	require.NoError(t, channel.Insert())
	require.NoError(t, db.Create(&Model{ModelName: "gpt-4", Status: 1, SyncOfficial: 1}).Error)

	availabilityQueries := make([]string, 0, 1)
	callbackName := "test:capture-model-availability-source-query"
	require.NoError(t, db.Callback().Row().After("gorm:row").Register(callbackName, func(tx *gorm.DB) {
		sql := strings.ToLower(tx.Statement.SQL.String())
		if strings.Contains(sql, "abilities") || strings.Contains(sql, "channels") {
			availabilityQueries = append(availabilityQueries, sql)
		}
	}))
	t.Cleanup(func() { _ = db.Callback().Row().Remove(callbackName) })

	result, err := ReconcileModelChannelAvailability(ModelChannelAvailabilityConfig{Disable: true})
	require.NoError(t, err)
	assert.Zero(t, result.Disabled)
	require.Len(t, availabilityQueries, 1)
	assert.Contains(t, availabilityQueries[0], "join channels")
}

func TestModelInsertPreservesZeroValuesAndIgnoresAutoDisabledMarker(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Model{}))

	originalDB := DB
	originalDatabaseType := common.MainDatabaseType()
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = originalDB
		common.SetMainDatabaseType(originalDatabaseType)
	})

	created := &Model{
		ModelName:          "gpt-4",
		Status:             0,
		SyncOfficial:       0,
		AutoDisabledByRule: true,
	}
	require.NoError(t, created.Insert())

	var persisted Model
	require.NoError(t, DB.First(&persisted, created.Id).Error)
	assert.False(t, created.AutoDisabledByRule)
	assert.Equal(t, 0, persisted.Status)
	assert.Equal(t, 0, persisted.SyncOfficial)
	assert.False(t, persisted.AutoDisabledByRule)
}
