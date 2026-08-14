package controller

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	appI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetInitialUnlimitedChannelUsesContextSnapshot(t *testing.T) {
	previousMemoryCache := common.MemoryCacheEnabled
	previousDB := model.DB
	common.MemoryCacheEnabled = false
	model.DB = nil
	t.Cleanup(func() {
		common.MemoryCacheEnabled = previousMemoryCache
		model.DB = previousDB
	})

	gin.SetMode(gin.TestMode)
	response := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(response)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	common.SetContextKey(ctx, constant.ContextKeyChannelId, 601)
	common.SetContextKey(ctx, constant.ContextKeyChannelType, 1)
	common.SetContextKey(ctx, constant.ContextKeyChannelName, "snapshot-channel")
	common.SetContextKey(ctx, constant.ContextKeyChannelAutoBan, true)
	common.SetContextKey(ctx, constant.ContextKeyChannelIsMultiKey, true)
	common.SetContextKey(ctx, constant.ContextKeyChannelSetting, dto.ChannelSettings{})

	channel, lease, newAPIError := getChannel(ctx, &relaycommon.RelayInfo{}, &service.RetryParam{})

	require.Nil(t, newAPIError)
	require.NotNil(t, channel)
	assert.Equal(t, 601, channel.Id)
	assert.Equal(t, "snapshot-channel", channel.Name)
	assert.True(t, channel.GetAutoBan())
	assert.True(t, channel.ChannelInfo.IsMultiKey)
	assert.Nil(t, lease)
}

func TestGetInitialLimitedChannelReturnsCapacityError(t *testing.T) {
	require.NoError(t, appI18n.Init())
	dsn := fmt.Sprintf("file:controller-limited-channel-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}))

	previousDB := model.DB
	previousMemoryCache := common.MemoryCacheEnabled
	previousRedisEnabled := common.RedisEnabled
	model.DB = db
	common.MemoryCacheEnabled = false
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = previousDB
		common.MemoryCacheEnabled = previousMemoryCache
		common.RedisEnabled = previousRedisEnabled
	})

	limitedChannel := &model.Channel{
		Id:     602,
		Name:   "limited-channel",
		Type:   constant.ChannelTypeOpenAI,
		Status: common.ChannelStatusEnabled,
	}
	limitedChannel.SetSetting(dto.ChannelSettings{MaxConcurrency: 1})
	require.NoError(t, db.Create(limitedChannel).Error)

	heldLease, decision, err := service.AcquireChannelAdmission(context.Background(), limitedChannel)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	defer func() { require.NoError(t, heldLease.Release()) }()

	response := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(response)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	common.SetContextKey(ctx, constant.ContextKeyChannelId, limitedChannel.Id)
	common.SetContextKey(ctx, constant.ContextKeyChannelSetting, limitedChannel.GetSetting())

	channel, lease, newAPIError := getChannel(ctx, &relaycommon.RelayInfo{}, &service.RetryParam{Ctx: ctx})

	assert.Nil(t, channel)
	assert.Nil(t, lease)
	require.NotNil(t, newAPIError)
	assert.Equal(t, http.StatusTooManyRequests, newAPIError.StatusCode)
	assert.Equal(t, types.ErrorCodeChannelCapacityExhausted, newAPIError.GetErrorCode())
	assert.Equal(t, "1", response.Header().Get("Retry-After"))
}

func TestChannelCapacityAPIErrorIsLocalAndNonRetryable(t *testing.T) {
	require.NoError(t, appI18n.Init())
	gin.SetMode(gin.TestMode)
	response := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(response)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	err := channelCapacityAPIError(ctx, 1500*time.Millisecond)

	assert.Equal(t, http.StatusTooManyRequests, err.StatusCode)
	assert.Equal(t, types.ErrorCodeChannelCapacityExhausted, err.GetErrorCode())
	assert.Equal(t, "2", response.Header().Get("Retry-After"))
	assert.True(t, types.IsSkipRetryError(err))
	assert.False(t, types.IsChannelError(err))
	assert.False(t, types.IsRecordErrorLog(err))
	assert.False(t, service.ShouldDisableChannel(err))
}

func TestShouldRetryTaskRelaySkipsChannelCapacity(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)

	capacityErr := &taskdto.TaskError{
		Code:       string(types.ErrorCodeChannelCapacityExhausted),
		StatusCode: http.StatusTooManyRequests,
		LocalError: true,
	}
	upstreamRateLimit := &taskdto.TaskError{
		Code:       "upstream_rate_limit",
		StatusCode: http.StatusTooManyRequests,
	}

	assert.False(t, shouldRetryTaskRelay(ctx, 1, capacityErr, 1))
	assert.True(t, shouldRetryTaskRelay(ctx, 1, upstreamRateLimit, 1))
}
