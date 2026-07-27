package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupOrderedRoutingChannels(t *testing.T, groups ...string) map[string]int {
	t.Helper()

	require.NoError(t, model.DB.AutoMigrate(&model.Ability{}))
	require.NoError(t, model.DB.Exec("DELETE FROM abilities").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM channels").Error)

	ids := make(map[string]int, len(groups))
	priority := int64(10)
	weight := uint(100)
	for i, group := range groups {
		channel := &model.Channel{
			Id:       91000 + i,
			Name:     "routing-" + group,
			Key:      "test-key",
			Status:   common.ChannelStatusEnabled,
			Models:   "shared-model",
			Group:    group,
			Priority: &priority,
			Weight:   &weight,
		}
		require.NoError(t, model.DB.Create(channel).Error)
		require.NoError(t, model.DB.Create(&model.Ability{
			Group:     group,
			Model:     "shared-model",
			ChannelId: channel.Id,
			Enabled:   true,
			Priority:  &priority,
			Weight:    weight,
		}).Error)
		ids[group] = channel.Id
	}

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	model.InitChannelCache()
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		_ = model.DB.Exec("DELETE FROM abilities").Error
		_ = model.DB.Exec("DELETE FROM channels").Error
	})
	return ids
}

func orderedRoutingContext(groups []string, crossGroupRetry bool) *gin.Context {
	ctx, _ := gin.CreateTestContext(nil)
	common.SetContextKey(ctx, constant.ContextKeyTokenGroupCandidates, groups)
	common.SetContextKey(ctx, constant.ContextKeyTokenCrossGroupRetry, crossGroupRetry)
	return ctx
}

func TestCacheGetRandomSatisfiedChannelUsesExplicitCandidateOrder(t *testing.T) {
	ids := setupOrderedRoutingChannels(t, "openai", "claude")
	ctx := orderedRoutingContext([]string{"openai", "claude"}, true)
	param := &RetryParam{Ctx: ctx, TokenGroup: "auto", ModelName: "shared-model"}

	channel, selectedGroup, err := CacheGetRandomSatisfiedChannel(param)

	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, ids["openai"], channel.Id)
	assert.Equal(t, "openai", selectedGroup)
}

func TestCacheGetRandomSatisfiedChannelSkipsUnavailableCandidatesBeforeAttempt(t *testing.T) {
	ids := setupOrderedRoutingChannels(t, "claude")
	ctx := orderedRoutingContext([]string{"openai", "claude"}, false)
	param := &RetryParam{Ctx: ctx, TokenGroup: "auto", ModelName: "shared-model"}

	channel, selectedGroup, err := CacheGetRandomSatisfiedChannel(param)

	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, ids["claude"], channel.Id)
	assert.Equal(t, "claude", selectedGroup)
}

func TestRetryParamCrossGroupTransitionIgnoresGlobalRetryCount(t *testing.T) {
	setupOrderedRoutingChannels(t, "openai", "claude")
	originalRetryTimes := common.RetryTimes
	common.RetryTimes = 0
	t.Cleanup(func() { common.RetryTimes = originalRetryTimes })

	ctx := orderedRoutingContext([]string{"openai", "claude"}, true)
	param := &RetryParam{Ctx: ctx, TokenGroup: "auto", ModelName: "shared-model"}
	first, firstGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, first)
	assert.Equal(t, "openai", firstGroup)

	param.MarkAttempted()
	require.True(t, param.HasNextRetry())
	require.True(t, param.AdvanceRetry())
	second, secondGroup, err := CacheGetRandomSatisfiedChannel(param)

	require.NoError(t, err)
	require.NotNil(t, second)
	assert.Equal(t, "claude", secondGroup)
}

func TestRetryParamDoesNotCrossGroupsWhenDisabled(t *testing.T) {
	setupOrderedRoutingChannels(t, "openai", "claude")
	originalRetryTimes := common.RetryTimes
	common.RetryTimes = 0
	t.Cleanup(func() { common.RetryTimes = originalRetryTimes })

	ctx := orderedRoutingContext([]string{"openai", "claude"}, false)
	param := &RetryParam{Ctx: ctx, TokenGroup: "auto", ModelName: "shared-model"}
	channel, selectedGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, "openai", selectedGroup)

	param.MarkAttempted()
	assert.False(t, param.HasNextRetry())
	assert.False(t, param.AdvanceRetry())
}

func TestCacheGetRandomSatisfiedChannelHonorsExplicitGroupOverride(t *testing.T) {
	ids := setupOrderedRoutingChannels(t, "openai", "claude")
	ctx := orderedRoutingContext([]string{"openai", "claude"}, true)
	param := &RetryParam{Ctx: ctx, TokenGroup: "claude", ModelName: "shared-model"}

	channel, selectedGroup, err := CacheGetRandomSatisfiedChannel(param)

	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, ids["claude"], channel.Id)
	assert.Equal(t, "claude", selectedGroup)
	assert.False(t, param.IsAutoRouting())
}
