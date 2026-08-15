package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelBalanceInfoPersistsNativeUnit(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Channel{}, &Ability{}))
	const channelID = 970001
	require.NoError(t, DB.Unscoped().Delete(&Channel{}, "id = ?", channelID).Error)
	t.Cleanup(func() { _ = DB.Unscoped().Delete(&Channel{}, "id = ?", channelID).Error })

	baseURL := "https://upstream.example"
	channel := &Channel{
		Id: channelID, Type: constant.ChannelTypeNewAPI, Key: "test-key",
		Name: "balance persistence test", Status: common.ChannelStatusEnabled, BaseURL: &baseURL,
	}
	require.NoError(t, DB.Create(channel).Error)

	info := ChannelBalanceInfo{
		Remaining: "12.5", Unit: ChannelBalanceUnitMoney,
		Currency: "USD", DisplayUnit: "$", UpdatedAt: 100,
	}
	legacyBalance := 12.5
	require.NoError(t, channel.UpdateBalanceInfo(info, &legacyBalance))

	persisted, err := GetChannelById(channelID, true)
	require.NoError(t, err)
	require.NotNil(t, persisted.BalanceInfo)
	assert.Equal(t, info, *persisted.BalanceInfo)
	assert.Equal(t, legacyBalance, persisted.Balance)
	assert.EqualValues(t, 100, persisted.BalanceUpdatedTime)
}
