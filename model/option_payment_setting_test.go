package model

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestUpdateOptions_NormalizesPaymentSettingBaseGroupEverywhere(t *testing.T) {
	initCol()
	require.NoError(t, DB.AutoMigrate(&Option{}))

	const key = "payment_setting.auto_switch_group_base_group"
	originalPaymentSetting := snapshotPaymentSettingForTopUpAutoSwitchTest()

	var originalOption Option
	err := DB.Where("key = ?", key).First(&originalOption).Error
	hadOriginalOption := err == nil
	require.True(t, err == nil || errors.Is(err, gorm.ErrRecordNotFound))

	common.OptionMapRWMutex.Lock()
	optionMapWasNil := common.OptionMap == nil
	if optionMapWasNil {
		common.OptionMap = make(map[string]string)
	}
	originalOptionMapValue, hadOriginalOptionMapValue := common.OptionMap[key]
	common.OptionMapRWMutex.Unlock()

	t.Cleanup(func() {
		restorePaymentSettingForTopUpAutoSwitchTest(originalPaymentSetting)
		if hadOriginalOption {
			_ = DB.Save(&originalOption).Error
		} else {
			_ = DB.Where("key = ?", key).Delete(&Option{}).Error
		}

		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		if optionMapWasNil {
			common.OptionMap = nil
			return
		}
		if hadOriginalOptionMapValue {
			common.OptionMap[key] = originalOptionMapValue
		} else {
			delete(common.OptionMap, key)
		}
	})

	require.NoError(t, UpdateOptions(map[string]string{key: "   "}))

	paymentSetting := operation_setting.GetPaymentSetting()
	assert.Equal(t, "default", paymentSetting.AutoSwitchGroupBaseGroup)

	var savedOption Option
	require.NoError(t, DB.Where("key = ?", key).First(&savedOption).Error)
	assert.Equal(t, "default", savedOption.Value)

	common.OptionMapRWMutex.RLock()
	optionMapValue := common.OptionMap[key]
	common.OptionMapRWMutex.RUnlock()
	assert.Equal(t, "default", optionMapValue)
}
