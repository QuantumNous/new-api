package model

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestModelUpdatesDistinguishIdempotentWritesFromMissingRows(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Model{}))

	const modelName = "model-idempotent-update-test"
	require.NoError(t, DB.Unscoped().Where("model_name = ?", modelName).Delete(&Model{}).Error)
	modelMeta := &Model{ModelName: modelName, Status: 1, SyncOfficial: 1}
	require.NoError(t, modelMeta.Insert())
	t.Cleanup(func() {
		_ = DB.Unscoped().Where("id = ?", modelMeta.Id).Delete(&Model{}).Error
	})

	require.NoError(t, modelMeta.UpdateWithOptions(nil, nil))
	require.NoError(t, UpdateModelStatus(modelMeta.Id, modelMeta.Status))
	require.ErrorIs(t, UpdateModelStatus(2_000_000_001, 1), gorm.ErrRecordNotFound)
}

func TestModelUpdatePolicyRejectsRenameButAllowsMetadataChanges(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Model{}))

	const modelName = "model-admin-rename-policy-test"
	const renamedModel = "model-admin-rename-policy-test-renamed"
	require.NoError(t, DB.Unscoped().Where("model_name IN ?", []string{modelName, renamedModel}).Delete(&Model{}).Error)
	modelMeta := &Model{ModelName: modelName, Description: "before", Status: 1, SyncOfficial: 1}
	require.NoError(t, modelMeta.Insert())
	t.Cleanup(func() {
		_ = DB.Unscoped().Where("id = ?", modelMeta.Id).Delete(&Model{}).Error
	})

	update := *modelMeta
	update.ModelName = renamedModel
	update.Description = "must roll back"
	require.ErrorIs(t, update.UpdateWithOptionsPolicy(nil, nil, false), ErrModelRenameForbidden)

	var stored Model
	require.NoError(t, DB.First(&stored, modelMeta.Id).Error)
	assert.Equal(t, modelName, stored.ModelName)
	assert.Equal(t, "before", stored.Description)

	update.ModelName = modelName
	update.Description = "after"
	require.NoError(t, update.UpdateWithOptionsPolicy(nil, nil, false))
	require.NoError(t, DB.First(&stored, modelMeta.Id).Error)
	assert.Equal(t, "after", stored.Description)
}

func TestDeleteModelRemovesResolutionPriceInSameTransaction(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Model{}, &Option{}))

	const modelName = "model-delete-resolution-price-test"
	const originalValue = `{"model-delete-resolution-price-test":{"4K":1.2},"keep-model":{"1K":0.25}}`
	savedRuntime := ratio_setting.ImageResolutionPrice2JSONString()
	var savedOption Option
	optionLookup := DB.Where("key = ?", "ImageResolutionPrice").First(&savedOption)
	hadOption := optionLookup.Error == nil
	require.True(t, optionLookup.Error == nil || errors.Is(optionLookup.Error, gorm.ErrRecordNotFound))
	require.NoError(t, DB.Save(&Option{Key: "ImageResolutionPrice", Value: originalValue}).Error)
	require.NoError(t, updateOptionMap("ImageResolutionPrice", originalValue))
	require.NoError(t, DB.Unscoped().Where("model_name = ?", modelName).Delete(&Model{}).Error)
	modelMeta := &Model{ModelName: modelName, Status: 1, SyncOfficial: 1}
	require.NoError(t, modelMeta.Insert())

	t.Cleanup(func() {
		_ = DB.Unscoped().Where("id = ?", modelMeta.Id).Delete(&Model{}).Error
		if hadOption {
			_ = DB.Save(&savedOption).Error
		} else {
			_ = DB.Where("key = ?", "ImageResolutionPrice").Delete(&Option{}).Error
		}
		_ = updateOptionMap("ImageResolutionPrice", savedRuntime)
	})

	require.NoError(t, DeleteModelWithImageResolutionPrice(modelMeta.Id))
	var count int64
	require.NoError(t, DB.Model(&Model{}).Where("id = ?", modelMeta.Id).Count(&count).Error)
	assert.Zero(t, count)
	var stored Option
	require.NoError(t, DB.Where("key = ?", "ImageResolutionPrice").First(&stored).Error)
	assert.JSONEq(t, `{"keep-model":{"1K":0.25}}`, stored.Value)
	assert.Equal(t, map[string]map[string]float64{"keep-model": {"1K": 0.25}}, ratio_setting.GetImageResolutionPriceCopy())
}

func TestDeleteModelRollsBackResolutionPriceWhenDeleteFails(t *testing.T) {
	if DB.Dialector.Name() != "sqlite" {
		t.Skip("failure injection uses a SQLite trigger")
	}
	require.NoError(t, DB.AutoMigrate(&Model{}, &Option{}))

	const modelName = "model-delete-resolution-price-rollback-test"
	const optionValue = `{"model-delete-resolution-price-rollback-test":{"4K":1.2}}`
	const triggerName = "fail_model_resolution_price_delete"
	savedRuntime := ratio_setting.ImageResolutionPrice2JSONString()
	var savedOption Option
	optionLookup := DB.Where("key = ?", "ImageResolutionPrice").First(&savedOption)
	hadOption := optionLookup.Error == nil
	require.True(t, optionLookup.Error == nil || errors.Is(optionLookup.Error, gorm.ErrRecordNotFound))
	require.NoError(t, DB.Save(&Option{Key: "ImageResolutionPrice", Value: optionValue}).Error)
	require.NoError(t, updateOptionMap("ImageResolutionPrice", optionValue))
	require.NoError(t, DB.Unscoped().Where("model_name = ?", modelName).Delete(&Model{}).Error)
	modelMeta := &Model{ModelName: modelName, Status: 1, SyncOfficial: 1}
	require.NoError(t, modelMeta.Insert())

	t.Cleanup(func() {
		_ = DB.Exec("DROP TRIGGER IF EXISTS " + triggerName).Error
		_ = DB.Unscoped().Where("id = ?", modelMeta.Id).Delete(&Model{}).Error
		if hadOption {
			_ = DB.Save(&savedOption).Error
		} else {
			_ = DB.Where("key = ?", "ImageResolutionPrice").Delete(&Option{}).Error
		}
		_ = updateOptionMap("ImageResolutionPrice", savedRuntime)
	})

	require.NoError(t, DB.Exec(`
		CREATE TRIGGER `+triggerName+`
		BEFORE UPDATE OF deleted_at ON models
		WHEN OLD.model_name = '`+modelName+`' AND NEW.deleted_at IS NOT NULL
		BEGIN
			SELECT RAISE(FAIL, 'forced model delete failure');
		END;
	`).Error)

	err := DeleteModelWithImageResolutionPrice(modelMeta.Id)
	require.ErrorContains(t, err, "forced model delete failure")
	var count int64
	require.NoError(t, DB.Model(&Model{}).Where("id = ?", modelMeta.Id).Count(&count).Error)
	assert.EqualValues(t, 1, count)
	var stored Option
	require.NoError(t, DB.Where("key = ?", "ImageResolutionPrice").First(&stored).Error)
	assert.JSONEq(t, optionValue, stored.Value)
	assert.Equal(t, map[string]map[string]float64{modelName: {"4K": 1.2}}, ratio_setting.GetImageResolutionPriceCopy())
}
