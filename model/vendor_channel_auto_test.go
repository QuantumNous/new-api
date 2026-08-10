package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEnsureVendorAndAutoBindModelsForNewChannel(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Channel{}, &Ability{}, &Vendor{}, &Model{}))

	uniqueChannelName := fmt.Sprintf("AutoVendorChan_%d", common.GetTimestamp())
	testModel1 := fmt.Sprintf("auto-test-model-1-%d", common.GetTimestamp())
	testModel2 := fmt.Sprintf("auto-test-model-2-%d", common.GetTimestamp())

	channel := &Channel{
		Type:   constant.ChannelTypeAdvancedCustom,
		Name:   uniqueChannelName,
		Key:    "sk-test-key",
		Models: fmt.Sprintf("%s,%s", testModel1, testModel2),
		Status: common.ChannelStatusEnabled,
	}

	err := channel.Insert()
	require.NoError(t, err)

	// 1. Verify Vendor was auto-created
	var vendor Vendor
	err = DB.Where("name = ? AND deleted_at IS NULL", uniqueChannelName).First(&vendor).Error
	require.NoError(t, err)
	assert.Equal(t, uniqueChannelName, vendor.Name)
	assert.Equal(t, 1, vendor.Status)

	// 2. Verify model metadata was auto-created and bound to vendor.Id
	var meta1 Model
	err = DB.Where("model_name = ? AND deleted_at IS NULL", testModel1).First(&meta1).Error
	require.NoError(t, err)
	assert.Equal(t, vendor.Id, meta1.VendorID)

	var meta2 Model
	err = DB.Where("model_name = ? AND deleted_at IS NULL", testModel2).First(&meta2).Error
	require.NoError(t, err)
	assert.Equal(t, vendor.Id, meta2.VendorID)
}
