package controller

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	intelligentrouting "github.com/QuantumNous/new-api/service/intelligent_routing"
	routingsetting "github.com/QuantumNous/new-api/setting/intelligent_routing_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildShadowRoutePlanDoesNotChangeLiveModelOrChannel(t *testing.T) {
	saved := routingsetting.Get()
	t.Cleanup(func() { require.NoError(t, routingsetting.Update(saved)) })
	require.NoError(t, routingsetting.Update(routingsetting.Config{
		Enabled: true, ShadowOnly: true,
		Models: []routingsetting.ModelPolicy{{Model: "cheap", Tier: 1, InputPrice: 1, OutputPrice: 2, ContextLimit: 8192}},
	}))
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	common.SetContextKey(ctx, constant.ContextKeyChannelId, 99)
	request := &dto.GeneralOpenAIRequest{Model: "client-model", Messages: []dto.Message{{Role: "user", Content: "hello"}}}
	info := &relaycommon.RelayInfo{OriginModelName: "client-model", TokenGroup: "default", Request: request, RelayFormat: types.RelayFormatOpenAI}
	err := buildShadowRoutePlan(ctx, info, 120, func(string, string) []*model.Channel {
		return []*model.Channel{{Id: 7, Status: common.ChannelStatusEnabled, Models: "cheap", Group: "default"}}
	})
	require.NoError(t, err)
	require.NotNil(t, info.IntelligentRoutePlan)
	assert.Equal(t, "client-model", info.OriginModelName)
	assert.Equal(t, 99, common.GetContextKeyInt(ctx, constant.ContextKeyChannelId))
	assert.Equal(t, "cheap", info.IntelligentRoutePlan.Nodes[0].Model)
}

func TestSupportsIntelligentRoutingOnlyForOpenAITextEndpoints(t *testing.T) {
	tests := []struct {
		name   string
		format types.RelayFormat
		mode   int
		want   bool
	}{
		{name: "chat", format: types.RelayFormatOpenAI, mode: relayconstant.RelayModeChatCompletions, want: true},
		{name: "responses", format: types.RelayFormatOpenAIResponses, mode: relayconstant.RelayModeResponses, want: true},
		{name: "responses compact", format: types.RelayFormatOpenAIResponsesCompaction, mode: relayconstant.RelayModeResponsesCompact, want: true},
		{name: "images", format: types.RelayFormatOpenAI, mode: relayconstant.RelayModeImagesGenerations},
		{name: "claude", format: types.RelayFormatClaude, mode: relayconstant.RelayModeChatCompletions},
		{name: "realtime", format: types.RelayFormatOpenAIRealtime, mode: relayconstant.RelayModeChatCompletions},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.want, supportsIntelligentRouting(test.format, test.mode))
		})
	}
}

func TestComputeLiveRoutePricingPreconsumesMostExpensiveCandidateAndRestoresFirst(t *testing.T) {
	savedPrices := ratio_setting.ModelPrice2JSONString()
	t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrices)) })
	prices, err := common.Marshal(map[string]float64{"cheap": 0.1, "fallback": 0.4})
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(string(prices)))
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{OriginModelName: "requested", UserGroup: "default", UsingGroup: "default", Request: &dto.GeneralOpenAIRequest{Model: "requested"}}
	plan := &hosttypes.IntelligentRoutePlan{Nodes: []hosttypes.IntelligentRouteNode{{Model: "cheap"}, {Model: "fallback"}}}
	priceData, err := computeLiveRoutePricing(ctx, info, plan, 100, &types.TokenCountMeta{})
	require.NoError(t, err)
	assert.Equal(t, "cheap", info.GetExecutionModelName())
	assert.Equal(t, 200000, priceData.QuotaToPreConsume)
	assert.Equal(t, 0.1, priceData.ModelPrice)
}

func TestApplyIntelligentRouteNodeSwitchesExecutionWithoutChangingRequestedModel(t *testing.T) {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	request := &dto.GeneralOpenAIRequest{Model: "requested"}
	info := &relaycommon.RelayInfo{OriginModelName: "requested", Request: request}
	channel := &model.Channel{Id: 7, Status: common.ChannelStatusEnabled, Models: "cheap", Group: "default", Key: "test-key"}
	err := applyIntelligentRouteNode(ctx, info, channel, hosttypes.IntelligentRouteNode{Model: "cheap", ChannelID: 7})
	require.Nil(t, err)
	assert.Equal(t, "requested", info.OriginModelName)
	assert.Equal(t, "cheap", info.GetExecutionModelName())
	assert.Equal(t, "cheap", request.Model)
	assert.Equal(t, 7, info.ChannelId)
}

func TestRecordIntelligentRouteHealthTracksOnlyLiveSelectedChannel(t *testing.T) {
	var tracker intelligentrouting.HealthTracker
	info := &relaycommon.RelayInfo{IntelligentRoutePlan: &hosttypes.IntelligentRoutePlan{}, IntelligentRouteShadow: false, ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 7}}
	recordIntelligentRouteHealth(&tracker, info, false)
	for i := 1; i < 20; i++ {
		tracker.Record(7, false)
	}
	assert.Equal(t, intelligentrouting.HealthOpen, tracker.Snapshot(7).Tier)

	shadow := &relaycommon.RelayInfo{IntelligentRoutePlan: &hosttypes.IntelligentRoutePlan{}, IntelligentRouteShadow: true, ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 8}}
	recordIntelligentRouteHealth(&tracker, shadow, false)
	assert.Equal(t, intelligentrouting.HealthProbation, tracker.Snapshot(8).Tier)
}

func TestBuildRoutePlanPrefersAffordableStickyNode(t *testing.T) {
	saved := routingsetting.Get()
	t.Cleanup(func() { require.NoError(t, routingsetting.Update(saved)) })
	require.NoError(t, routingsetting.Update(routingsetting.Config{
		Enabled: true, MaxAttempts: 3,
		Models: []routingsetting.ModelPolicy{
			{Model: "cheapest", Tier: 1, InputPrice: 1, OutputPrice: 1},
			{Model: "sticky", Tier: 1, InputPrice: 1.1, OutputPrice: 1.1},
			{Model: "safest", Tier: 1, InputPrice: 5, OutputPrice: 5},
		},
	}))
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	ctx.Request.Header.Set("X-Session-ID", "sticky-test-session")
	request := &dto.GeneralOpenAIRequest{Model: "requested", Messages: []dto.Message{{Role: "user", Content: "hello"}}}
	info := &relaycommon.RelayInfo{UserId: 42, OriginModelName: "requested", TokenGroup: "default", Request: request, RelayFormat: types.RelayFormatOpenAI}
	key := intelligentrouting.ConversationKey("42", "sticky-test-session", "hello")
	intelligentrouting.DefaultStickinessStore.Record(key, intelligentrouting.TaskGeneral, intelligentrouting.StickyRoute{Model: "sticky", ChannelID: 2})
	err := buildShadowRoutePlan(ctx, info, 100, func(string, string) []*model.Channel {
		return []*model.Channel{
			{Id: 1, Status: common.ChannelStatusEnabled, Models: "cheapest", Group: "default"},
			{Id: 2, Status: common.ChannelStatusEnabled, Models: "sticky", Group: "default"},
			{Id: 3, Status: common.ChannelStatusEnabled, Models: "safest", Group: "default"},
		}
	})
	require.NoError(t, err)
	assert.Equal(t, "sticky", info.IntelligentRoutePlan.Nodes[0].Model)
	assert.Equal(t, key, info.IntelligentRouteSessionKey)
}

func TestRecordIntelligentRouteSuccessCreatesStickyRoute(t *testing.T) {
	var store intelligentrouting.StickinessStore
	info := &relaycommon.RelayInfo{
		ExecutionModelName: "cheap", IntelligentRouteSessionKey: "session-key", IntelligentRouteTask: string(intelligentrouting.TaskSummary),
		IntelligentRoutePlan: &hosttypes.IntelligentRoutePlan{}, ChannelMeta: &relaycommon.ChannelMeta{ChannelId: 7},
	}
	recordIntelligentRouteSuccess(&store, info)
	route, ok := store.Get("session-key", intelligentrouting.TaskSummary)
	require.True(t, ok)
	assert.Equal(t, "cheap", route.Model)
	assert.Equal(t, 7, route.ChannelID)
}

func TestRecordIntelligentRouteAttemptCapturesOutcomeAndLatency(t *testing.T) {
	info := &relaycommon.RelayInfo{IntelligentRoutePlan: &hosttypes.IntelligentRoutePlan{}}
	node := hosttypes.IntelligentRouteNode{Model: "cheap", ChannelID: 7}
	recordIntelligentRouteAttempt(info, node, 1, time.UnixMilli(1000), time.UnixMilli(1125), "failed", "timeout")
	require.Len(t, info.IntelligentRouteAttempts, 1)
	assert.Equal(t, int64(125), info.IntelligentRouteAttempts[0].LatencyMS)
	assert.Equal(t, "timeout", info.IntelligentRouteAttempts[0].FailureReason)
}
