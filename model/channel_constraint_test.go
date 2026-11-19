package model

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFilterCandidateIDs(t *testing.T) {
	ordinary := &Channel{Id: 900003, Type: constant.ChannelTypeOpenAI}
	matchingCustom := &Channel{Id: 900010, Type: constant.ChannelTypeAdvancedCustom}
	matchingCustom.SetOtherSettings(kitdto.ChannelOtherSettings{AdvancedCustom: &kitdto.AdvancedCustomConfig{
		Routes: []kitdto.AdvancedCustomRoute{{IncomingPath: "/v1/chat/completions", Models: []string{"gpt-4"}}},
	}})
	otherCustom := &Channel{Id: 900011, Type: constant.ChannelTypeAdvancedCustom}
	otherCustom.SetOtherSettings(kitdto.ChannelOtherSettings{AdvancedCustom: &kitdto.AdvancedCustomConfig{
		Routes: []kitdto.AdvancedCustomRoute{{IncomingPath: "/v1/responses", Models: []string{"gpt-4"}}},
	}})

	channelSyncLock.Lock()
	previous := channelsIDM
	channelsIDM = map[int]*Channel{900003: ordinary, 900010: matchingCustom, 900011: otherCustom}
	t.Cleanup(func() { channelsIDM = previous; channelSyncLock.Unlock() })

	kept, emptiedBy := filterCandidateIDs([]int{900003, 900010, 900011, 999999}, "gpt-4", []dto.ChannelFilter{{
		Kind: dto.FilterRequestPath, RequestPath: "/v1/chat/completions",
	}})
	assert.Equal(t, []int{900003, 900010, 999999}, kept)
	assert.Empty(t, emptiedBy)

	kept, emptiedBy = filterCandidateIDs([]int{900011}, "gpt-4", []dto.ChannelFilter{{
		Kind: dto.FilterRequestPath, RequestPath: "/v1/chat/completions",
	}})
	assert.Empty(t, kept)
	assert.Equal(t, dto.FilterRequestPath, emptiedBy)
}

func TestChannelSatisfiesFilters(t *testing.T) {
	ordinary := &Channel{Id: 2, Type: constant.ChannelTypeOpenAI}
	custom := &Channel{Id: 3, Type: constant.ChannelTypeAdvancedCustom}
	custom.SetOtherSettings(kitdto.ChannelOtherSettings{AdvancedCustom: &kitdto.AdvancedCustomConfig{
		Routes: []kitdto.AdvancedCustomRoute{{IncomingPath: "/v1/chat/completions", Models: []string{"gpt-4"}}},
	}})

	ok, kind := ChannelSatisfiesFilters(nil, "gpt-4", nil)
	assert.False(t, ok)
	assert.Empty(t, kind)

	ok, kind = ChannelSatisfiesFilters(ordinary, "gpt-4", []dto.ChannelFilter{{
		Kind: dto.FilterRequestPath, RequestPath: "/v1/chat/completions",
	}})
	require.True(t, ok)
	assert.Empty(t, kind)

	ok, kind = ChannelSatisfiesFilters(custom, "gpt-4", []dto.ChannelFilter{{
		Kind: dto.FilterRequestPath, RequestPath: "/v1/responses",
	}})
	assert.False(t, ok)
	assert.Equal(t, dto.FilterRequestPath, kind)
}

func TestResponsesWebSocketFilter(t *testing.T) {
	channel := &Channel{Id: 4, Type: constant.ChannelTypeOpenAI}
	channel.SetSetting(kitdto.ChannelSettings{ResponsesWebSocketEnabled: true})
	filters := []dto.ChannelFilter{{Kind: dto.FilterResponsesWebSocket}}

	ok, kind := ChannelSatisfiesFilters(channel, "gpt-4", filters)
	assert.True(t, ok)
	assert.Empty(t, kind)

	channel.SetSetting(kitdto.ChannelSettings{ResponsesWebSocketEnabled: false})
	ok, kind = ChannelSatisfiesFilters(channel, "gpt-4", filters)
	assert.False(t, ok)
	assert.Equal(t, dto.FilterResponsesWebSocket, kind)
}
