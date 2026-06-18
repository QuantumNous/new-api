package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestGetRandomSatisfiedChannelWithTypesFiltersCandidates(t *testing.T) {
	restore := installTestChannelCache(t)
	defer restore()

	openAIWeight := uint(100)
	awsWeight := uint(100)
	priority := int64(10)
	group2model2channels = map[string]map[string][]int{
		"default": {
			"claude-3-5-sonnet-20240620": {1, 2},
		},
	}
	channelsIDM = map[int]*Channel{
		1: {Id: 1, Type: constant.ChannelTypeOpenAI, Weight: &openAIWeight, Priority: &priority},
		2: {Id: 2, Type: constant.ChannelTypeAws, Weight: &awsWeight, Priority: &priority},
	}

	channel, err := GetRandomSatisfiedChannelWithTypes("default", "claude-3-5-sonnet-20240620", 0, []int{constant.ChannelTypeAws})

	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 2, channel.Id)
}

func TestGetRandomSatisfiedChannelWithTypesReturnsNilWhenNoCandidateMatches(t *testing.T) {
	restore := installTestChannelCache(t)
	defer restore()

	weight := uint(100)
	priority := int64(10)
	group2model2channels = map[string]map[string][]int{
		"default": {
			"claude-3-5-sonnet-20240620": {1},
		},
	}
	channelsIDM = map[int]*Channel{
		1: {Id: 1, Type: constant.ChannelTypeOpenAI, Weight: &weight, Priority: &priority},
	}

	channel, err := GetRandomSatisfiedChannelWithTypes("default", "claude-3-5-sonnet-20240620", 0, []int{constant.ChannelTypeAws})

	require.NoError(t, err)
	require.Nil(t, channel)
}

func installTestChannelCache(t *testing.T) func() {
	t.Helper()

	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldGroup2Model2Channels := group2model2channels
	oldChannelsIDM := channelsIDM
	common.MemoryCacheEnabled = true

	return func() {
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		group2model2channels = oldGroup2Model2Channels
		channelsIDM = oldChannelsIDM
	}
}
