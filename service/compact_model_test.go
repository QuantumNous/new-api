package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCompactChannelStageCapabilities(t *testing.T) {
	openAI := &model.Channel{Type: constant.ChannelTypeOpenAI}
	mapping := `{"gpt-5":"real-openai-compact"}`
	openAI.ModelMapping = &mapping
	require.True(t, compactChannelSupportsStage(openAI, map[string]bool{"gpt-5": true}, "gpt-5", "gpt-5-openai-compact", relaycommon.CompactAttemptExact))
	require.True(t, compactChannelSupportsStage(openAI, map[string]bool{"gpt-5": true}, "gpt-5", "gpt-5-openai-compact", relaycommon.CompactAttemptBase))

	unsupported := &model.Channel{Type: constant.ChannelTypeOpenRouter}
	require.False(t, compactChannelSupportsStage(unsupported, map[string]bool{"gpt-5-openai-compact": true}, "gpt-5", "gpt-5-openai-compact", relaycommon.CompactAttemptExact))
}

func TestNonGPTCompactChannelUsesOnlyBaseAbility(t *testing.T) {
	channel := &model.Channel{Type: constant.ChannelTypeOpenAI, Models: "claude-3-5-sonnet-openai-compact"}
	require.Equal(t, relaycommon.CompactAttemptNone, SpecificChannelCompactStage(channel, "claude-3-5-sonnet-openai-compact"))

	channel.Models = "claude-3-5-sonnet"
	require.Equal(t, relaycommon.CompactAttemptBase, SpecificChannelCompactStage(channel, "claude-3-5-sonnet-openai-compact"))
	require.False(t, compactChannelSupportsStage(
		channel,
		map[string]bool{"claude-3-5-sonnet-openai-compact": true},
		"claude-3-5-sonnet",
		"claude-3-5-sonnet",
		relaycommon.CompactAttemptExact,
	))
}

func TestAdvancedCustomCompactRequiresExplicitRoute(t *testing.T) {
	channel := &model.Channel{Type: constant.ChannelTypeAdvancedCustom}
	channel.SetOtherSettings(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{{IncomingPath: "/v1/responses", UpstreamPath: "/v1/responses"}},
	}})
	require.False(t, channelSupportsCompactEndpoint(channel, "gpt-5"))

	channel.SetOtherSettings(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{{IncomingPath: "/v1/responses/compact", UpstreamPath: "/v1/responses/compact"}},
	}})
	require.True(t, channelSupportsCompactEndpoint(channel, "gpt-5"))
}

func TestNativeResponsesCapability(t *testing.T) {
	require.True(t, ChannelSupportsNativeResponses(&model.Channel{Type: constant.ChannelTypeOpenAI}, "gpt-5"))
	require.False(t, ChannelSupportsNativeResponses(&model.Channel{Type: constant.ChannelTypeGemini}, "gpt-5"))

	channel := &model.Channel{Type: constant.ChannelTypeAdvancedCustom}
	channel.SetOtherSettings(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{{
			IncomingPath: "/v1/responses",
			UpstreamPath: "/responses",
			Converter:    "none",
			Models:       []string{"gpt-5"},
		}},
	}})
	require.True(t, ChannelSupportsNativeResponses(channel, "gpt-5"))

	channel.SetOtherSettings(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{{
			IncomingPath: "/v1/responses",
			UpstreamPath: "/chat/completions",
			Converter:    "openai_responses_to_openai_chat_completions",
			Models:       []string{"gpt-5"},
		}},
	}})
	require.False(t, ChannelSupportsNativeResponses(channel, "gpt-5"))
}

func TestNativeResponsesChannelSelectionFiltersConvertedChannels(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "remote-compaction-model"
	createChannelSelectAutoGroupsChannel(t, db, 2205, "default", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2206, "default", modelName)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2206).Update("type", constant.ChannelTypeGemini).Error)
	model.InitChannelCache()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	retry := 0
	param := &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "default",
		ModelName:   modelName,
		RequestPath: "/v1/responses",
		Retry:       &retry,
	}
	selected, _, err := CacheGetRandomSatisfiedChannelWithFilter(param, func(channel *model.Channel, _ map[string]bool) bool {
		return ChannelSupportsNativeResponses(channel, modelName)
	})
	require.NoError(t, err)
	require.NotNil(t, selected)
	require.Equal(t, 2205, selected.Id)

	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2205).Update("type", constant.ChannelTypeGemini).Error)
	model.InitChannelCache()
	selected, _, err = CacheGetRandomSatisfiedChannelWithFilter(param, func(channel *model.Channel, _ map[string]bool) bool {
		return ChannelSupportsNativeResponses(channel, modelName)
	})
	require.NoError(t, err)
	require.Nil(t, selected)
}

func TestCompactChannelSelectionExcludesUsedSingleKeyChannel(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const (
		channelID = 2201
		modelName = "compact-single-key-model"
	)
	createChannelSelectAutoGroupsChannel(t, db, channelID, "default", modelName)
	model.InitChannelCache()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	retry := 0
	param := &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "default",
		RequestPath: "/v1/responses/compact",
		Retry:       &retry,
	}

	selected, _, err := CacheGetRandomSatisfiedCompactChannel(param, modelName, relaycommon.CompactAttemptBase)
	require.NoError(t, err)
	require.NotNil(t, selected)
	require.Equal(t, channelID, selected.Id)

	SetCompactAttemptedKeyIndexes(ctx, CompactAttemptedKeyIndexes{
		channelID: {0: {}},
	})
	selected, _, err = CacheGetRandomSatisfiedCompactChannel(param, modelName, relaycommon.CompactAttemptBase)
	require.NoError(t, err)
	require.Nil(t, selected)
}

func TestCompactChannelSelectionAllowsEachMultiKeyOncePerStage(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const (
		channelID = 2202
		modelName = "compact-multi-key-model"
	)
	createChannelSelectAutoGroupsChannel(t, db, channelID, "default", modelName)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channelID).Updates(map[string]any{
		"key": "key-one\nkey-disabled\nkey-three",
		"channel_info": model.ChannelInfo{
			IsMultiKey: true,
			MultiKeyStatusList: map[int]int{
				1: common.ChannelStatusAutoDisabled,
			},
		},
	}).Error)
	model.InitChannelCache()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	retry := 0
	param := &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "default",
		RequestPath: "/v1/responses/compact",
		Retry:       &retry,
	}

	SetCompactAttemptedKeyIndexes(ctx, CompactAttemptedKeyIndexes{
		channelID: {0: {}},
	})
	selected, _, err := CacheGetRandomSatisfiedCompactChannel(param, modelName, relaycommon.CompactAttemptBase)
	require.NoError(t, err)
	require.NotNil(t, selected)
	require.Equal(t, channelID, selected.Id)

	SetCompactAttemptedKeyIndexes(ctx, CompactAttemptedKeyIndexes{
		channelID: {0: {}, 2: {}},
	})
	selected, _, err = CacheGetRandomSatisfiedCompactChannel(param, modelName, relaycommon.CompactAttemptBase)
	require.NoError(t, err)
	require.Nil(t, selected)
}

func TestCompactAutoGroupCanRestartFromFirstGroupForBaseStage(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "gpt-compact-auto-stage-model"
	createChannelSelectAutoGroupsChannel(t, db, 2203, "vip", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2204, "default", modelName)
	model.InitChannelCache()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenAutoGroups, []string{"vip", "default"})
	common.SetContextKey(ctx, constant.ContextKeyTokenCrossGroupRetry, true)
	retry := 0
	param := &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "auto",
		RequestPath: "/v1/responses/compact",
		Retry:       &retry,
	}

	selected, _, err := CacheGetRandomSatisfiedCompactChannel(param, modelName, relaycommon.CompactAttemptExact)
	require.NoError(t, err)
	require.Nil(t, selected)

	ResetCompactAutoGroupSelection(ctx)
	param.SetRetry(0)
	selected, selectedGroup, err := CacheGetRandomSatisfiedCompactChannel(param, modelName, relaycommon.CompactAttemptBase)
	require.NoError(t, err)
	require.NotNil(t, selected)
	require.Equal(t, 2203, selected.Id)
	require.Equal(t, "vip", selectedGroup)
}
