package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupOptionTestDB(t *testing.T) {
	t.Helper()

	previousDB := DB
	previousLogDB := LOG_DB
	previousServerAddress := system_setting.ServerAddress

	common.OptionMapRWMutex.RLock()
	previousOptionMap := cloneOptionMap(common.OptionMap)
	common.OptionMapRWMutex.RUnlock()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Option{}))

	DB = db
	LOG_DB = db

	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
		DB = previousDB
		LOG_DB = previousLogDB
		system_setting.ServerAddress = previousServerAddress
		common.OptionMapRWMutex.Lock()
		common.OptionMap = cloneOptionMap(previousOptionMap)
		common.OptionMapRWMutex.Unlock()
	})
}

func cloneOptionMap(source map[string]string) map[string]string {
	if source == nil {
		return nil
	}
	cloned := make(map[string]string, len(source))
	for key, value := range source {
		cloned[key] = value
	}
	return cloned
}

func TestInitOptionMapSeedsServerAddressFromEnvWhenMissing(t *testing.T) {
	setupOptionTestDB(t)
	t.Setenv("SERVER_ADDRESS", "https://example.com")

	InitOptionMap()

	var option Option
	require.NoError(t, DB.Where(&Option{Key: "ServerAddress"}).First(&option).Error)
	assert.Equal(t, "https://example.com", option.Value)
	assert.Equal(t, "https://example.com", system_setting.ServerAddress)
}

func TestInitOptionMapDoesNotOverrideExistingServerAddress(t *testing.T) {
	setupOptionTestDB(t)
	t.Setenv("SERVER_ADDRESS", "https://env.example.com")
	require.NoError(t, DB.Create(&Option{Key: "ServerAddress", Value: "https://db.example.com"}).Error)

	InitOptionMap()

	var option Option
	require.NoError(t, DB.Where(&Option{Key: "ServerAddress"}).First(&option).Error)
	assert.Equal(t, "https://db.example.com", option.Value)
	assert.Equal(t, "https://db.example.com", system_setting.ServerAddress)
}
