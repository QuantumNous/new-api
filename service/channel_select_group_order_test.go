package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCacheGetRandomSatisfiedChannelUsesGroupOrder verifies the openLUX group_ids
// equivalent (Token.GroupOrder): routing follows the ordered group list even when
// the token's group is NOT "auto", falling through to the next group when the
// current one has no channel.
func TestCacheGetRandomSatisfiedChannelUsesGroupOrder(t *testing.T) {
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 0
	defer func() {
		common.RetryTimes = oldRetryTimes
	}()

	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "group-order-runtime-model"
	createChannelSelectAutoGroupsChannel(t, db, 2201, "vip", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2202, "default", modelName)
	model.InitChannelCache()

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	// group_order：有序分组列表，令牌 group 保持普通分组（此处 "vip"，非 "auto"）
	common.SetContextKey(ctx, constant.ContextKeyTokenGroupOrder, []string{"vip", "default"})
	common.SetContextKey(ctx, constant.ContextKeyTokenCrossGroupRetry, true)

	retry := 0
	param := &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "vip",
		ModelName:   modelName,
		RequestPath: "/v1/chat/completions",
		Retry:       &retry,
	}

	first, selectedGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, first)
	assert.Equal(t, 2201, first.Id)
	assert.Equal(t, "vip", selectedGroup)
	assert.Equal(t, "vip", common.GetContextKeyString(ctx, constant.ContextKeyAutoGroup))

	param.IncreaseRetry()
	second, selectedGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, second)
	assert.Equal(t, 2202, second.Id)
	assert.Equal(t, "default", selectedGroup)
	assert.Equal(t, "default", common.GetContextKeyString(ctx, constant.ContextKeyAutoGroup))
}

// TestCacheGetRandomSatisfiedChannelForcedGroupByModelSuffix verifies the request-level
// model suffix override (model@g2, openLUX compatible): the forced group wins over
// the token's single group.
func TestCacheGetRandomSatisfiedChannelForcedGroupByModelSuffix(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "suffix-override-runtime-model"
	createChannelSelectAutoGroupsChannel(t, db, 2203, "vip", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2204, "default", modelName)
	model.InitChannelCache()

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	// 请求 model 形如 "deepseek-chat@vip"，distributor 解析后写入强制分组
	common.SetContextKey(ctx, constant.ContextKeyModelGroupOverride, "vip")

	retry := 0
	param := &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "default",
		ModelName:   modelName,
		RequestPath: "/v1/chat/completions",
		Retry:       &retry,
	}

	channel, selectedGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 2203, channel.Id)
	assert.Equal(t, "vip", selectedGroup)
	assert.Equal(t, "vip", common.GetContextKeyString(ctx, constant.ContextKeyAutoGroup))
}

// TestApplyModelGroupSuffixGroupOrderPrecedence verifies that when the model suffix
// override is present it beats the token-level group_order.
func TestApplyModelGroupSuffixBeatsGroupOrder(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "suffix-beats-order-runtime-model"
	createChannelSelectAutoGroupsChannel(t, db, 2205, "vip", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2206, "default", modelName)
	model.InitChannelCache()

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	// 同时有 group_order 与 model 后缀强制分组：强制分组优先级更高
	common.SetContextKey(ctx, constant.ContextKeyTokenGroupOrder, []string{"default", "vip"})
	common.SetContextKey(ctx, constant.ContextKeyModelGroupOverride, "vip")

	retry := 0
	param := &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "default",
		ModelName:   modelName,
		RequestPath: "/v1/chat/completions",
		Retry:       &retry,
	}

	channel, selectedGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 2205, channel.Id)
	assert.Equal(t, "vip", selectedGroup)
	assert.Equal(t, "vip", common.GetContextKeyString(ctx, constant.ContextKeyAutoGroup))
}
