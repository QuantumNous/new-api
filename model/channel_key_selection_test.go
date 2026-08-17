package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestGetNextEnabledKeyExcludingRandomUsesRemainingEnabledKey(t *testing.T) {
	channel := &Channel{
		Id:  801,
		Key: "key-zero\nkey-disabled\nkey-two",
		ChannelInfo: ChannelInfo{
			IsMultiKey:   true,
			MultiKeyMode: constant.MultiKeyModeRandom,
			MultiKeyStatusList: map[int]int{
				1: common.ChannelStatusAutoDisabled,
			},
		},
	}

	key, index, apiErr := channel.GetNextEnabledKeyExcluding(map[int]struct{}{0: {}})
	require.Nil(t, apiErr)
	require.Equal(t, "key-two", key)
	require.Equal(t, 2, index)

	_, _, apiErr = channel.GetNextEnabledKeyExcluding(map[int]struct{}{0: {}, 2: {}})
	require.NotNil(t, apiErr)
}

func TestGetNextEnabledKeyExcludingPollingSkipsAttemptedAndDisabledKeys(t *testing.T) {
	resetPricingEndpointTestTables(t)
	channel := &Channel{
		Id:     802,
		Name:   "polling-key-exclusion",
		Status: common.ChannelStatusEnabled,
		Key:    "key-zero\nkey-disabled\nkey-two",
		Group:  "default",
		Models: "polling-key-model",
		ChannelInfo: ChannelInfo{
			IsMultiKey:           true,
			MultiKeyMode:         constant.MultiKeyModePolling,
			MultiKeyPollingIndex: 0,
			MultiKeyStatusList: map[int]int{
				1: common.ChannelStatusAutoDisabled,
			},
		},
	}
	require.NoError(t, DB.Create(channel).Error)
	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "polling-key-model",
		ChannelId: channel.Id,
		Enabled:   true,
	}).Error)
	InitChannelCache()
	cached, err := CacheGetChannel(channel.Id)
	require.NoError(t, err)

	key, index, apiErr := cached.GetNextEnabledKeyExcluding(map[int]struct{}{0: {}})
	require.Nil(t, apiErr)
	require.Equal(t, "key-two", key)
	require.Equal(t, 2, index)

	_, _, apiErr = cached.GetNextEnabledKeyExcluding(map[int]struct{}{0: {}, 2: {}})
	require.NotNil(t, apiErr)
}
