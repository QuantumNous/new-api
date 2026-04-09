package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestChannelOrderedEnabledKeyIndices_PollingDoesNotAdvanceUntilCommitted(t *testing.T) {
	channel := &Channel{
		Id: 42,
		Key: "k0\nk1\nk2",
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
			MultiKeySize: 3,
			MultiKeyMode: constant.MultiKeyModePolling,
			MultiKeyPollingIndex: 1,
			MultiKeyStatusList: map[int]int{
				2: common.ChannelStatusAutoDisabled,
			},
		},
	}

	lock := GetChannelPollingLock(channel.Id)
	lock.Lock()
	ordered, err := channel.OrderedEnabledKeyIndices()
	lock.Unlock()
	require.NoError(t, err)
	require.Equal(t, []int{1, 0}, ordered)
	require.Equal(t, 1, channel.ChannelInfo.MultiKeyPollingIndex)

	key, err := channel.KeyAt(0)
	require.NoError(t, err)
	require.Equal(t, "k0", key)

	lock.Lock()
	err = channel.CommitSelectedKeyIndex(1)
	lock.Unlock()
	require.NoError(t, err)
	require.Equal(t, 2, channel.ChannelInfo.MultiKeyPollingIndex)
}
