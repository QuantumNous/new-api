package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
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
