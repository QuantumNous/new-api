package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupToolPriceOptionTest(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), newGormConfig(false))
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Option{}))
	oldDB := DB
	DB = db
	common.OptionMapRWMutex.Lock()
	oldOptions := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		DB = oldDB
		operation_setting.LoadToolPricesFromJSONString(`{}`)
		common.OptionMapRWMutex.Lock()
		common.OptionMap = oldOptions
		common.OptionMapRWMutex.Unlock()
	})
}

func TestUpdateOptionRejectsInvalidToolPricesBeforeWrite(t *testing.T) {
	setupToolPriceOptionTest(t)
	require.Error(t, UpdateOption(operation_setting.ToolPriceOptionKey, `{"web_search":-1}`))
	var count int64
	require.NoError(t, DB.Model(&Option{}).Where("key = ?", operation_setting.ToolPriceOptionKey).Count(&count).Error)
	assert.Zero(t, count)
}

func TestUpdateOptionsBulkToolPriceValidationIsAtomic(t *testing.T) {
	setupToolPriceOptionTest(t)
	require.Error(t, UpdateOptionsBulk(map[string]string{
		operation_setting.ToolPriceOptionKey: `{"bad tool":1}`,
		"unrelated":                          "must-not-write",
	}))
	var count int64
	require.NoError(t, DB.Model(&Option{}).Count(&count).Error)
	assert.Zero(t, count)
	common.OptionMapRWMutex.RLock()
	_, exists := common.OptionMap["unrelated"]
	common.OptionMapRWMutex.RUnlock()
	assert.False(t, exists)
}

func TestUpdateOptionLoadsValidToolPriceIndex(t *testing.T) {
	setupToolPriceOptionTest(t)
	require.NoError(t, UpdateOption(operation_setting.ToolPriceOptionKey, `{"stage2_tool:model*":7}`))
	assert.Equal(t, float64(7), operation_setting.GetToolPriceForModel("stage2_tool", "model-v1"))
}
