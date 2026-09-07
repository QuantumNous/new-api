package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestGetEnabledKeyAtSelectsExactEnabledKey(t *testing.T) {
	channel := &Channel{
		Key: "k0\nk1\nk2",
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
			MultiKeyStatusList: map[int]int{
				1: common.ChannelStatusAutoDisabled,
			},
		},
	}

	key, index, err := channel.GetEnabledKeyAt(2)
	require.Nil(t, err)
	require.Equal(t, "k2", key)
	require.Equal(t, 2, index)

	_, _, err = channel.GetEnabledKeyAt(1)
	require.NotNil(t, err)
}

func TestGetEnabledKeyAtSingleKeyOnlyAcceptsZero(t *testing.T) {
	channel := &Channel{Key: "single"}
	key, index, err := channel.GetEnabledKeyAt(0)
	require.Nil(t, err)
	require.Equal(t, "single", key)
	require.Equal(t, 0, index)

	_, _, err = channel.GetEnabledKeyAt(1)
	require.NotNil(t, err)
}
