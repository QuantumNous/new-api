package controller

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetChannelReacquiresContextChannelConcurrency(t *testing.T) {
	prevDB := model.DB
	prevMemoryCacheEnabled := common.MemoryCacheEnabled
	prevRDB := common.RDB
	prevRedisEnabled := common.RedisEnabled
	t.Cleanup(func() {
		model.DB = prevDB
		common.MemoryCacheEnabled = prevMemoryCacheEnabled
		common.RDB = prevRDB
		common.RedisEnabled = prevRedisEnabled
	})

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}))
	model.DB = db
	common.MemoryCacheEnabled = false
	common.RDB = nil
	common.RedisEnabled = false

	channel := &model.Channel{
		Id:             909901,
		Type:           constant.ChannelTypeOpenAI,
		Key:            "sk-test",
		Status:         common.ChannelStatusEnabled,
		Name:           "limited",
		Group:          "default",
		Models:         "gpt-test",
		MaxConcurrency: 1,
	}
	require.NoError(t, model.DB.Create(channel).Error)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(c, constant.ContextKeyChannelId, channel.Id)
	common.SetContextKey(c, constant.ContextKeyChannelType, channel.Type)
	common.SetContextKey(c, constant.ContextKeyChannelName, channel.Name)
	common.SetContextKey(c, constant.ContextKeyChannelAutoBan, channel.GetAutoBan())

	ok, err := service.AcquireChannelConcurrencyForContext(c, channel)
	require.NoError(t, err)
	require.True(t, ok)
	require.NoError(t, service.ReleaseChannelConcurrencyForContext(c))

	heldLease, ok, err := service.TryAcquireChannelConcurrency(context.Background(), channel)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, heldLease)
	t.Cleanup(func() {
		require.NoError(t, service.ReleaseChannelConcurrency(context.Background(), heldLease))
	})

	retry := 0
	selected, channelErr := getChannel(c, &relaycommon.RelayInfo{
		TokenGroup:      "default",
		OriginModelName: "gpt-test",
	}, &service.RetryParam{
		Ctx:        c,
		TokenGroup: "default",
		ModelName:  "gpt-test",
		Retry:      &retry,
	})

	require.Nil(t, selected)
	require.NotNil(t, channelErr)
	require.Equal(t, http.StatusTooManyRequests, channelErr.StatusCode)
}

func TestProcessChannelErrorMarksCooldownOnTooManyRequests(t *testing.T) {
	restoreRuntime := useControllerMemoryChannelConcurrencyForTest(t)
	defer restoreRuntime()
	prevErrorLogEnabled := constant.ErrorLogEnabled
	constant.ErrorLogEnabled = false
	defer func() {
		constant.ErrorLogEnabled = prevErrorLogEnabled
	}()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	channelID := 909902

	processChannelError(
		c,
		*types.NewChannelError(channelID, constant.ChannelTypeOpenAI, "cooldown", false, "", false),
		types.NewOpenAIError(errors.New("upstream rate limited"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
	)

	loads, err := service.GetChannelConcurrencyLoads(context.Background(), []*model.Channel{{Id: channelID, MaxConcurrency: 1}})
	require.NoError(t, err)
	require.True(t, loads[channelID].CoolingDown)
}

func TestProcessChannelErrorMarksRedisCooldownWithCanceledRequestContext(t *testing.T) {
	mr := miniredis.RunT(t)
	prevRDB := common.RDB
	prevRedisEnabled := common.RedisEnabled
	common.RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	common.RedisEnabled = true
	t.Cleanup(func() {
		_ = common.RDB.Close()
		common.RDB = prevRDB
		common.RedisEnabled = prevRedisEnabled
		mr.Close()
	})
	prevErrorLogEnabled := constant.ErrorLogEnabled
	constant.ErrorLogEnabled = false
	t.Cleanup(func() {
		constant.ErrorLogEnabled = prevErrorLogEnabled
	})

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	reqCtx, cancel := context.WithCancel(context.Background())
	cancel()
	c.Request = httptest.NewRequestWithContext(reqCtx, http.MethodPost, "/v1/chat/completions", nil)
	channelID := 909905

	processChannelError(
		c,
		*types.NewChannelError(channelID, constant.ChannelTypeOpenAI, "cooldown", false, "", false),
		types.NewOpenAIError(errors.New("rate limit exceeded"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
	)

	loads, err := service.GetChannelConcurrencyLoads(context.Background(), []*model.Channel{{Id: channelID, MaxConcurrency: 1}})
	require.NoError(t, err)
	require.True(t, loads[channelID].CoolingDown)
}

func TestShouldMarkChannelConcurrencyCooldownExcludesQuota429(t *testing.T) {
	require.False(t, shouldMarkChannelConcurrencyCooldown(
		types.NewOpenAIError(errors.New("insufficient_quota: quota exceeded"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
	))
	require.False(t, shouldMarkChannelConcurrencyCooldown(
		types.NewOpenAIError(errors.New("账户余额不足"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
	))
	require.True(t, shouldMarkChannelConcurrencyCooldown(
		types.NewOpenAIError(errors.New("rate limit exceeded"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
	))
	require.True(t, shouldMarkChannelConcurrencyCooldown(
		types.NewOpenAIError(errors.New(""), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
	))
}

func TestGetChannelSkipsCoolingDownChannel(t *testing.T) {
	restoreRuntime := useControllerMemoryChannelConcurrencyForTest(t)
	defer restoreRuntime()
	restoreDB := useControllerChannelSelectionDBForTest(t)
	defer restoreDB()

	priority := int64(0)
	coolingWeight := uint(1_000_000)
	fallbackWeight := uint(1)
	coolingChannel := &model.Channel{
		Id:             909903,
		Type:           constant.ChannelTypeOpenAI,
		Key:            "sk-cooling",
		Status:         common.ChannelStatusEnabled,
		Name:           "cooling",
		Group:          "default",
		Models:         "gpt-cooldown",
		Priority:       &priority,
		Weight:         &coolingWeight,
		MaxConcurrency: 2,
	}
	fallbackChannel := &model.Channel{
		Id:             909904,
		Type:           constant.ChannelTypeOpenAI,
		Key:            "sk-fallback",
		Status:         common.ChannelStatusEnabled,
		Name:           "fallback",
		Group:          "default",
		Models:         "gpt-cooldown",
		Priority:       &priority,
		Weight:         &fallbackWeight,
		MaxConcurrency: 2,
	}
	require.NoError(t, model.DB.Create(coolingChannel).Error)
	require.NoError(t, coolingChannel.AddAbilities(nil))
	require.NoError(t, model.DB.Create(fallbackChannel).Error)
	require.NoError(t, fallbackChannel.AddAbilities(nil))
	model.InitChannelCache()

	require.NoError(t, service.MarkChannelConcurrencyCooldown(context.Background(), coolingChannel.Id, time.Second, "test cooldown"))

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	retry := 0
	selected, channelErr := getChannel(c, &relaycommon.RelayInfo{
		TokenGroup:      "default",
		OriginModelName: "gpt-cooldown",
		ChannelMeta:     &relaycommon.ChannelMeta{},
	}, &service.RetryParam{
		Ctx:        c,
		TokenGroup: "default",
		ModelName:  "gpt-cooldown",
		Retry:      &retry,
	})
	defer func() {
		require.NoError(t, service.ReleaseChannelConcurrencyForContext(c))
	}()

	require.Nil(t, channelErr)
	require.NotNil(t, selected)
	require.Equal(t, fallbackChannel.Id, selected.Id)
}

func useControllerMemoryChannelConcurrencyForTest(t *testing.T) func() {
	t.Helper()
	prevRDB := common.RDB
	prevRedisEnabled := common.RedisEnabled
	common.RDB = nil
	common.RedisEnabled = false
	return func() {
		common.RDB = prevRDB
		common.RedisEnabled = prevRedisEnabled
	}
}

func useControllerChannelSelectionDBForTest(t *testing.T) func() {
	t.Helper()
	prevDB := model.DB
	prevMemoryCacheEnabled := common.MemoryCacheEnabled
	prevUsingSQLite := common.UsingSQLite
	prevUsingMySQL := common.UsingMySQL
	prevUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	model.DB = db
	common.MemoryCacheEnabled = true
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	return func() {
		model.DB = prevDB
		common.MemoryCacheEnabled = prevMemoryCacheEnabled
		common.UsingSQLite = prevUsingSQLite
		common.UsingMySQL = prevUsingMySQL
		common.UsingPostgreSQL = prevUsingPostgreSQL
	}
}
