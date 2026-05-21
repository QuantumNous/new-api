package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestGetEnabledKeyByIndex(t *testing.T) {
	channel := &Channel{
		Id:  9001,
		Key: "key-a\nkey-b\nkey-c",
		ChannelInfo: ChannelInfo{
			IsMultiKey:           true,
			MultiKeyMode:         constant.MultiKeyModePolling,
			MultiKeyPollingIndex: 0,
			MultiKeyStatusList: map[int]int{
				1: common.ChannelStatusEnabled,
			},
		},
	}

	key, index, apiErr := channel.GetEnabledKeyByIndex(1)
	require.Nil(t, apiErr)
	require.Equal(t, "key-b", key)
	require.Equal(t, 1, index)
	require.Equal(t, 0, channel.ChannelInfo.MultiKeyPollingIndex)
}

func TestGetEnabledKeyByIndexDisabled(t *testing.T) {
	channel := &Channel{
		Id:  9002,
		Key: "key-a\nkey-b",
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
			MultiKeyStatusList: map[int]int{
				1: common.ChannelStatusManuallyDisabled,
			},
		},
	}

	key, index, apiErr := channel.GetEnabledKeyByIndex(1)
	require.NotNil(t, apiErr)
	require.Empty(t, key)
	require.Equal(t, 0, index)
}
