package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestUpdateImageResolutionPriceLeavesRuntimeUnchangedWhenDatabaseWriteFails(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Option{}))
	savedPrices := ratio_setting.ImageResolutionPrice2JSONString()
	common.OptionMapRWMutex.Lock()
	savedOptionMap := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	var savedOption Option
	optionLookup := DB.Where("key = ?", "ImageResolutionPrice").First(&savedOption)
	hadSavedOption := optionLookup.Error == nil
	if optionLookup.Error != nil {
		require.ErrorIs(t, optionLookup.Error, gorm.ErrRecordNotFound)
	}
	t.Cleanup(func() {
		_ = DB.Exec("DROP TRIGGER IF EXISTS fail_image_resolution_price_update").Error
		if hadSavedOption {
			require.NoError(t, DB.Save(&savedOption).Error)
		} else {
			require.NoError(t, DB.Where("key = ?", "ImageResolutionPrice").Delete(&Option{}).Error)
		}
		require.NoError(t, ratio_setting.UpdateImageResolutionPriceByJSONString(savedPrices))
		common.OptionMapRWMutex.Lock()
		common.OptionMap = savedOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	oldValue := `{"image-model":{"1K":0.25}}`
	newValue := `{"image-model":{"4K":1.2}}`
	require.NoError(t, DB.Save(&Option{Key: "ImageResolutionPrice", Value: oldValue}).Error)
	require.NoError(t, ratio_setting.UpdateImageResolutionPriceByJSONString(oldValue))
	common.OptionMapRWMutex.Lock()
	common.OptionMap["ImageResolutionPrice"] = oldValue
	common.OptionMapRWMutex.Unlock()
	require.NoError(t, DB.Exec(`
		CREATE TRIGGER fail_image_resolution_price_update
		BEFORE UPDATE OF value ON options
		WHEN NEW.key = 'ImageResolutionPrice'
		BEGIN
			SELECT RAISE(FAIL, 'forced image resolution price write failure');
		END;
	`).Error)

	err := UpdateOption("ImageResolutionPrice", newValue)
	require.ErrorContains(t, err, "forced image resolution price write failure")
	price, ok := ratio_setting.GetImageResolutionPrice("image-model", "1K")
	require.True(t, ok)
	assert.Equal(t, 0.25, price)
	_, ok = ratio_setting.GetImageResolutionPrice("image-model", "4K")
	assert.False(t, ok)
	common.OptionMapRWMutex.RLock()
	assert.Equal(t, oldValue, common.OptionMap["ImageResolutionPrice"])
	common.OptionMapRWMutex.RUnlock()
}
