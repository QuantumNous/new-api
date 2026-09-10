package service

import (
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func createPriorityPlanChannel(t *testing.T, db *gorm.DB, id int, priority int64, group, modelName string) {
	t.Helper()
	weight := uint(100)
	require.NoError(t, db.Create(&model.Channel{
		Id:       id,
		Type:     constant.ChannelTypeOpenAI,
		Key:      fmt.Sprintf("key-%d", id),
		Status:   common.ChannelStatusEnabled,
		Name:     fmt.Sprintf("channel-%d", id),
		Weight:   &weight,
		Models:   modelName,
		Group:    group,
		Priority: &priority,
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     group,
		Model:     modelName,
		ChannelId: id,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
}

func newPriorityPlanRetryParam(ctx *gin.Context, modelName string, retry int) *RetryParam {
	return &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "default",
		ModelName:   modelName,
		RequestPath: "/v1/chat/completions",
		Retry:       &retry,
	}
}

func TestChannelPriorityPlanDoesNotShiftAfterCachedChannelRemoval(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "priority-plan-cache-model"
	createPriorityPlanChannel(t, db, 2201, 30, "default", modelName)
	createPriorityPlanChannel(t, db, 2202, 28, "default", modelName)
	createPriorityPlanChannel(t, db, 2203, 27, "default", modelName)
	model.InitChannelCache()

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	first, _, err := CacheGetRandomSatisfiedChannel(newPriorityPlanRetryParam(ctx, modelName, 0))
	require.NoError(t, err)
	require.NotNil(t, first)
	assert.Equal(t, 2201, first.Id)

	model.CacheUpdateChannelStatus(first.Id, common.ChannelStatusAutoDisabled)
	second, _, err := CacheGetRandomSatisfiedChannel(newPriorityPlanRetryParam(ctx, modelName, 1))
	require.NoError(t, err)
	require.NotNil(t, second)
	assert.Equal(t, 2202, second.Id)
}

func TestPrepareChannelPriorityPlanPreservesAffinityRetryRank(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "priority-plan-affinity-model"
	createPriorityPlanChannel(t, db, 2401, 30, "default", modelName)
	createPriorityPlanChannel(t, db, 2402, 28, "default", modelName)
	createPriorityPlanChannel(t, db, 2403, 27, "default", modelName)
	model.InitChannelCache()

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	param := newPriorityPlanRetryParam(ctx, modelName, 0)
	require.NoError(t, PrepareChannelPriorityPlan(param, "default"))

	// The affinity-selected first attempt used the lowest-priority channel.
	// Existing retry rank 1 must still resolve to priority 28, not stop below 27.
	second, _, err := CacheGetRandomSatisfiedChannel(newPriorityPlanRetryParam(ctx, modelName, 1))
	require.NoError(t, err)
	require.NotNil(t, second)
	assert.Equal(t, 2402, second.Id)
}

func TestChannelPriorityPlansAreScopedPerAutoGroup(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	common.RetryTimes = 2
	const modelName = "priority-plan-auto-group-model"
	createPriorityPlanChannel(t, db, 2501, 30, "vip", modelName)
	createPriorityPlanChannel(t, db, 2502, 28, "vip", modelName)
	createPriorityPlanChannel(t, db, 2503, 27, "vip", modelName)
	createPriorityPlanChannel(t, db, 2504, 10, "default", modelName)
	model.InitChannelCache()

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenAutoGroups, []string{"vip", "default"})
	common.SetContextKey(ctx, constant.ContextKeyTokenCrossGroupRetry, true)
	retry := 0
	param := &RetryParam{
		Ctx: ctx, TokenGroup: "auto", ModelName: modelName,
		RequestPath: "/v1/chat/completions", Retry: &retry,
	}

	first, group, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, first)
	assert.Equal(t, "vip", group)
	assert.Equal(t, 2501, first.Id)

	model.CacheUpdateChannelStatus(first.Id, common.ChannelStatusAutoDisabled)
	param.IncreaseRetry()
	second, group, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, second)
	assert.Equal(t, "vip", group)
	assert.Equal(t, 2502, second.Id)
	require.Equal(t, []int64{30, 28, 27}, param.priorityPlans["vip"])
	assert.Nil(t, param.priorityPlans["default"])
}
