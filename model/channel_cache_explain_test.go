package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
)

// withCandidateCache installs a synthetic channel cache for the duration of a
// test and restores the previous one afterwards.
func withCandidateCache(t *testing.T, channels map[int]*Channel, byGroupModel map[string]map[string][]int) {
	t.Helper()

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalChannelsIDM := channelsIDM
	originalGroup2Model2Channels := group2model2channels

	channelSyncLock.Lock()
	channelsIDM = channels
	group2model2channels = byGroupModel
	channelSyncLock.Unlock()
	common.MemoryCacheEnabled = true

	t.Cleanup(func() {
		channelSyncLock.Lock()
		channelsIDM = originalChannelsIDM
		group2model2channels = originalGroup2Model2Channels
		channelSyncLock.Unlock()
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
	})
}

// newAdvancedCustomChannel builds a type-58 channel that only serves the given
// incoming paths for the given models.
func newAdvancedCustomChannel(id int, name string, routes []kitdto.AdvancedCustomRoute) *Channel {
	channel := &Channel{Id: id, Type: constant.ChannelTypeAdvancedCustom, Status: common.ChannelStatusEnabled, Name: name}
	channel.SetOtherSettings(kitdto.ChannelOtherSettings{
		AdvancedCustom: &kitdto.AdvancedCustomConfig{Routes: routes},
	})
	return channel
}

func TestExplainEmptyCandidatesAttributesRequestPathFilter(t *testing.T) {
	// Declares /v1/chat/completions only, so a Playground request must be
	// rejected by the request-path filter.
	channel := newAdvancedCustomChannel(910001, "chat-only", []kitdto.AdvancedCustomRoute{{
		IncomingPath: "/v1/chat/completions",
		Models:       []string{"gpt-4"},
	}})
	withCandidateCache(t,
		map[int]*Channel{910001: channel},
		map[string]map[string][]int{"default": {"gpt-4": {910001}}},
	)

	kind, rejected := ExplainEmptyCandidates("default", "gpt-4", []dto.ChannelFilter{{
		Kind:        dto.FilterRequestPath,
		RequestPath: "/pg/chat/completions",
	}})

	assert.Equal(t, dto.FilterRequestPath, kind)
	if assert.NotNil(t, rejected) {
		assert.Equal(t, 910001, rejected.Id)
	}
}

func TestExplainEmptyCandidatesSilentWhenPathMatches(t *testing.T) {
	channel := newAdvancedCustomChannel(910002, "chat-only", []kitdto.AdvancedCustomRoute{{
		IncomingPath: "/v1/chat/completions",
		Models:       []string{"gpt-4"},
	}})
	withCandidateCache(t,
		map[int]*Channel{910002: channel},
		map[string]map[string][]int{"default": {"gpt-4": {910002}}},
	)

	kind, rejected := ExplainEmptyCandidates("default", "gpt-4", []dto.ChannelFilter{{
		Kind:        dto.FilterRequestPath,
		RequestPath: "/v1/chat/completions",
	}})

	assert.Equal(t, dto.ChannelFilterKind(""), kind)
	assert.Nil(t, rejected)
}

// An empty candidate list has a different cause than a filtered-out one, so the
// caller must fall back to the generic message rather than blaming a filter.
func TestExplainEmptyCandidatesSilentWhenNoCandidateExists(t *testing.T) {
	withCandidateCache(t,
		map[int]*Channel{},
		map[string]map[string][]int{"default": {"gpt-4": {}}},
	)

	kind, rejected := ExplainEmptyCandidates("default", "gpt-4", []dto.ChannelFilter{{
		Kind:        dto.FilterRequestPath,
		RequestPath: "/pg/chat/completions",
	}})

	assert.Equal(t, dto.ChannelFilterKind(""), kind)
	assert.Nil(t, rejected)
}

// Without the memory cache the candidate list is not maintained, so attribution
// is unavailable and the caller must degrade to the generic message.
func TestExplainEmptyCandidatesSilentWithoutMemoryCache(t *testing.T) {
	withCandidateCache(t,
		map[int]*Channel{910003: newAdvancedCustomChannel(910003, "chat-only", []kitdto.AdvancedCustomRoute{{
			IncomingPath: "/v1/chat/completions",
			Models:       []string{"gpt-4"},
		}})},
		map[string]map[string][]int{"default": {"gpt-4": {910003}}},
	)
	common.MemoryCacheEnabled = false

	kind, rejected := ExplainEmptyCandidates("default", "gpt-4", []dto.ChannelFilter{{
		Kind:        dto.FilterRequestPath,
		RequestPath: "/pg/chat/completions",
	}})

	assert.Equal(t, dto.ChannelFilterKind(""), kind)
	assert.Nil(t, rejected)
}

// Ordinary channels ignore the request-path filter, so a path mismatch on a
// non-advanced-custom channel must not be reported as a path rejection.
func TestExplainEmptyCandidatesIgnoresPathFilterForOrdinaryChannel(t *testing.T) {
	ordinary := &Channel{Id: 910004, Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled, Name: "openai"}
	withCandidateCache(t,
		map[int]*Channel{910004: ordinary},
		map[string]map[string][]int{"default": {"gpt-4": {910004}}},
	)

	kind, rejected := ExplainEmptyCandidates("default", "gpt-4", []dto.ChannelFilter{{
		Kind:        dto.FilterRequestPath,
		RequestPath: "/pg/chat/completions",
	}})

	assert.Equal(t, dto.ChannelFilterKind(""), kind)
	assert.Nil(t, rejected)
}
