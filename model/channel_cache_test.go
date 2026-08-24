package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestGetSatisfiedChannelCandidatesWithFilterReturnsEmptyWhenRetryExhausted(t *testing.T) {
	prevMemoryCacheEnabled := common.MemoryCacheEnabled
	prevGroup2Model2Channels := group2model2channels
	prevChannelsIDM := channelsIDM
	t.Cleanup(func() {
		common.MemoryCacheEnabled = prevMemoryCacheEnabled
		group2model2channels = prevGroup2Model2Channels
		channelsIDM = prevChannelsIDM
	})

	common.MemoryCacheEnabled = true
	highPriority := int64(10)
	lowPriority := int64(1)
	group2model2channels = map[string]map[string][]int{
		"default": {
			"gpt-test": {1, 2},
		},
	}
	channelsIDM = map[int]*Channel{
		1: {Id: 1, Status: common.ChannelStatusEnabled, Priority: &highPriority},
		2: {Id: 2, Status: common.ChannelStatusEnabled, Priority: &lowPriority},
	}

	candidates, err := GetSatisfiedChannelCandidatesWithFilter("default", "gpt-test", 99, nil)
	require.NoError(t, err)
	require.Empty(t, candidates)
}

func TestSelectWeightedRandomChannelReturnsErrorOnWeightOverflow(t *testing.T) {
	maxIntWeight := uint(^uint(0) >> 1)
	channels := []*Channel{
		{Id: 1, Weight: &maxIntWeight},
		{Id: 2, Weight: &maxIntWeight},
	}

	selected, err := SelectWeightedRandomChannel(channels)
	require.Error(t, err)
	require.Nil(t, selected)
}
