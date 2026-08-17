package service

import (
	"net/http/httptest"
	"strconv"
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

	ctx.Set("compact_stage_channels", []string{strconv.Itoa(channelID)})
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
		"key":          "key-one\nkey-two",
		"channel_info": model.ChannelInfo{IsMultiKey: true},
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

	ctx.Set("compact_stage_channels", []string{strconv.Itoa(channelID)})
	selected, _, err := CacheGetRandomSatisfiedCompactChannel(param, modelName, relaycommon.CompactAttemptBase)
	require.NoError(t, err)
	require.NotNil(t, selected)
	require.Equal(t, channelID, selected.Id)

	ctx.Set("compact_stage_channels", []string{strconv.Itoa(channelID), strconv.Itoa(channelID)})
	selected, _, err = CacheGetRandomSatisfiedCompactChannel(param, modelName, relaycommon.CompactAttemptBase)
	require.NoError(t, err)
	require.Nil(t, selected)
}

func TestCompactAutoGroupCanRestartFromFirstGroupForBaseStage(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "compact-auto-stage-model"
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
