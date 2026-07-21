package model

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestUpdateOptionsBulkRollsBackDatabaseAndRuntimeTogether(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Option{}))
	const firstKey = "AtomicBatchTestFirst"
	const secondKey = "AtomicBatchTestSecond"
	require.NoError(t, DB.Save(&Option{Key: firstKey, Value: "old-first"}).Error)
	require.NoError(t, DB.Save(&Option{Key: secondKey, Value: "old-second"}).Error)
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	oldFirstRuntime, hadFirstRuntime := common.OptionMap[firstKey]
	oldSecondRuntime, hadSecondRuntime := common.OptionMap[secondKey]
	common.OptionMap[firstKey] = "old-first"
	common.OptionMap[secondKey] = "old-second"
	common.OptionMapRWMutex.Unlock()

	t.Cleanup(func() {
		_ = DB.Exec("DROP TRIGGER IF EXISTS fail_atomic_batch_test").Error
		_ = DB.Where("key IN ?", []string{firstKey, secondKey}).Delete(&Option{}).Error
		common.OptionMapRWMutex.Lock()
		if hadFirstRuntime {
			common.OptionMap[firstKey] = oldFirstRuntime
		} else {
			delete(common.OptionMap, firstKey)
		}
		if hadSecondRuntime {
			common.OptionMap[secondKey] = oldSecondRuntime
		} else {
			delete(common.OptionMap, secondKey)
		}
		common.OptionMapRWMutex.Unlock()
	})

	require.NoError(t, DB.Exec(`
		CREATE TRIGGER fail_atomic_batch_test
		BEFORE UPDATE OF value ON options
		WHEN NEW.key = 'AtomicBatchTestSecond'
		BEGIN
			SELECT RAISE(FAIL, 'forced atomic batch failure');
		END;
	`).Error)

	err := UpdateOptionsBulk(map[string]string{
		firstKey:  "new-first",
		secondKey: "new-second",
	})
	require.ErrorContains(t, err, "forced atomic batch failure")

	var first, second Option
	require.NoError(t, DB.Where("key = ?", firstKey).First(&first).Error)
	require.NoError(t, DB.Where("key = ?", secondKey).First(&second).Error)
	assert.Equal(t, "old-first", first.Value)
	assert.Equal(t, "old-second", second.Value)
	common.OptionMapRWMutex.RLock()
	assert.Equal(t, "old-first", common.OptionMap[firstKey])
	assert.Equal(t, "old-second", common.OptionMap[secondKey])
	common.OptionMapRWMutex.RUnlock()
}

func TestInsertModelWithOptionsRollsBackModelDatabaseAndRuntimeTogether(t *testing.T) {
	if DB.Dialector.Name() != "sqlite" {
		t.Skip("failure injection uses a SQLite trigger")
	}
	require.NoError(t, DB.AutoMigrate(&Option{}, &Model{}))

	const modelName = "atomic-image-model-create"
	const triggerName = "fail_atomic_model_option_create"
	savedRuntime := ratio_setting.ModelPrice2JSONString()
	var savedOption Option
	optionLookup := DB.Where("key = ?", "ModelPrice").First(&savedOption)
	hadOption := optionLookup.Error == nil
	require.True(t, optionLookup.Error == nil || errors.Is(optionLookup.Error, gorm.ErrRecordNotFound))

	oldValue := savedRuntime
	newValue := `{"atomic-image-model-create":1.25}`
	require.NoError(t, DB.Save(&Option{Key: "ModelPrice", Value: oldValue}).Error)
	require.NoError(t, updateOptionMap("ModelPrice", oldValue))
	require.NoError(t, DB.Unscoped().Where("model_name = ?", modelName).Delete(&Model{}).Error)

	t.Cleanup(func() {
		_ = DB.Exec("DROP TRIGGER IF EXISTS " + triggerName).Error
		_ = DB.Unscoped().Where("model_name = ?", modelName).Delete(&Model{}).Error
		if hadOption {
			_ = DB.Save(&savedOption).Error
		} else {
			_ = DB.Where("key = ?", "ModelPrice").Delete(&Option{}).Error
		}
		_ = updateOptionMap("ModelPrice", savedRuntime)
	})

	require.NoError(t, DB.Exec(`
		CREATE TRIGGER `+triggerName+`
		BEFORE UPDATE OF value ON options
		WHEN NEW.key = 'ModelPrice'
		BEGIN
			SELECT RAISE(FAIL, 'forced model option failure');
		END;
	`).Error)

	m := &Model{ModelName: modelName, Status: 1, SyncOfficial: 1}
	err := m.InsertWithOptions(map[string]string{"ModelPrice": newValue}, nil)
	require.ErrorContains(t, err, "forced model option failure")

	var count int64
	require.NoError(t, DB.Unscoped().Model(&Model{}).Where("model_name = ?", modelName).Count(&count).Error)
	assert.Zero(t, count)
	var stored Option
	require.NoError(t, DB.Where("key = ?", "ModelPrice").First(&stored).Error)
	assert.Equal(t, oldValue, stored.Value)
	assert.Equal(t, savedRuntime, ratio_setting.ModelPrice2JSONString())
	common.OptionMapRWMutex.RLock()
	assert.Equal(t, oldValue, common.OptionMap["ModelPrice"])
	common.OptionMapRWMutex.RUnlock()
}

func TestUpdateAtomicOptionsBulkRejectsStaleExpectedValue(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Option{}))
	savedRuntime := ratio_setting.ModelPrice2JSONString()
	var savedOption Option
	optionLookup := DB.Where("key = ?", "ModelPrice").First(&savedOption)
	hadOption := optionLookup.Error == nil
	require.True(t, optionLookup.Error == nil || errors.Is(optionLookup.Error, gorm.ErrRecordNotFound))
	require.NoError(t, DB.Save(&Option{Key: "ModelPrice", Value: savedRuntime}).Error)
	require.NoError(t, updateOptionMap("ModelPrice", savedRuntime))
	t.Cleanup(func() {
		if hadOption {
			_ = DB.Save(&savedOption).Error
		} else {
			_ = DB.Where("key = ?", "ModelPrice").Delete(&Option{}).Error
		}
		_ = updateOptionMap("ModelPrice", savedRuntime)
	})

	err := UpdateAtomicOptionsBulk(
		map[string]string{"ModelPrice": `{"stale-cas-model":2}`},
		map[string]string{"ModelPrice": `{"stale-cas-model":1}`},
	)
	require.ErrorIs(t, err, ErrOptionUpdateConflict)

	var stored Option
	require.NoError(t, DB.Where("key = ?", "ModelPrice").First(&stored).Error)
	assert.Equal(t, savedRuntime, stored.Value)
	assert.Equal(t, savedRuntime, ratio_setting.ModelPrice2JSONString())
}

func TestUpdateMissingModelWithOptionsRollsBackOptions(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Option{}, &Model{}))
	savedRuntime := ratio_setting.ModelPrice2JSONString()
	var savedOption Option
	optionLookup := DB.Where("key = ?", "ModelPrice").First(&savedOption)
	hadOption := optionLookup.Error == nil
	require.True(t, optionLookup.Error == nil || errors.Is(optionLookup.Error, gorm.ErrRecordNotFound))
	require.NoError(t, DB.Save(&Option{Key: "ModelPrice", Value: savedRuntime}).Error)
	require.NoError(t, updateOptionMap("ModelPrice", savedRuntime))
	t.Cleanup(func() {
		if hadOption {
			_ = DB.Save(&savedOption).Error
		} else {
			_ = DB.Where("key = ?", "ModelPrice").Delete(&Option{}).Error
		}
		_ = updateOptionMap("ModelPrice", savedRuntime)
	})

	m := &Model{Id: 2_000_000_000, ModelName: "missing-model", Status: 1, SyncOfficial: 1}
	err := m.UpdateWithOptions(map[string]string{"ModelPrice": `{"missing-model":1}`}, nil)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)

	var stored Option
	require.NoError(t, DB.Where("key = ?", "ModelPrice").First(&stored).Error)
	assert.Equal(t, savedRuntime, stored.Value)
	assert.Equal(t, savedRuntime, ratio_setting.ModelPrice2JSONString())
}
