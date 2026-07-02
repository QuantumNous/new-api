package service

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelSelectEndpointTestDB(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))

	model.DB = db
	common.MemoryCacheEnabled = true
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	t.Cleanup(func() {
		model.DB = originalDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
}

func TestCacheGetRandomSatisfiedChannelAllowsBlockRunForResponsesEndpoint(t *testing.T) {
	setupChannelSelectEndpointTestDB(t)
	gin.SetMode(gin.TestMode)

	priority := int64(100)
	blockRunWeight := uint(1000)
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:       100,
		Type:     constant.ChannelTypeBlockRun,
		Key:      "blockrun-key",
		Name:     "blockrun",
		Status:   common.ChannelStatusEnabled,
		Priority: &priority,
		Weight:   &blockRunWeight,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "standard",
		Model:     "gpt-5.4",
		ChannelId: 100,
		Enabled:   true,
		Priority:  &priority,
		Weight:    blockRunWeight,
	}).Error)
	model.InitChannelCache()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	channel, selectedGroup, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx:        ctx,
		TokenGroup: "standard",
		ModelName:  "gpt-5.4",
		Retry:      common.GetPointer(0),
	})

	require.NoError(t, err)
	require.Equal(t, "standard", selectedGroup)
	require.NotNil(t, channel)
	require.Equal(t, 100, channel.Id)
}

func TestCacheGetRandomSatisfiedChannelSkipsUnsupportedNonBlockRunForResponsesEndpoint(t *testing.T) {
	setupChannelSelectEndpointTestDB(t)
	gin.SetMode(gin.TestMode)

	highPriority := int64(100)
	lowPriority := int64(10)
	highWeight := uint(1000)
	lowWeight := uint(1)
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:       110,
		Type:     constant.ChannelTypeAnthropic,
		Key:      "anthropic-key",
		Name:     "anthropic",
		Status:   common.ChannelStatusEnabled,
		Priority: &highPriority,
		Weight:   &highWeight,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:       111,
		Type:     constant.ChannelTypeOpenAI,
		Key:      "openai-key",
		Name:     "openai",
		Status:   common.ChannelStatusEnabled,
		Priority: &lowPriority,
		Weight:   &lowWeight,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "standard",
		Model:     "gpt-5.4",
		ChannelId: 110,
		Enabled:   true,
		Priority:  &highPriority,
		Weight:    highWeight,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "standard",
		Model:     "gpt-5.4",
		ChannelId: 111,
		Enabled:   true,
		Priority:  &lowPriority,
		Weight:    lowWeight,
	}).Error)
	model.InitChannelCache()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	channel, selectedGroup, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx:        ctx,
		TokenGroup: "standard",
		ModelName:  "gpt-5.4",
		Retry:      common.GetPointer(0),
	})

	require.NoError(t, err)
	require.Equal(t, "standard", selectedGroup)
	require.NotNil(t, channel)
	require.Equal(t, 111, channel.Id)
}

func TestDBGetRandomSatisfiedChannelFiltersBeforeRetryPriority(t *testing.T) {
	setupChannelSelectEndpointTestDB(t)
	common.MemoryCacheEnabled = false
	gin.SetMode(gin.TestMode)

	highPriority := int64(100)
	lowPriority := int64(10)
	highWeight := uint(1000)
	lowWeight := uint(1)
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:       120,
		Type:     constant.ChannelTypeAnthropic,
		Key:      "anthropic-key",
		Name:     "anthropic",
		Status:   common.ChannelStatusEnabled,
		Priority: &highPriority,
		Weight:   &highWeight,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:       121,
		Type:     constant.ChannelTypeOpenAI,
		Key:      "openai-key",
		Name:     "openai",
		Status:   common.ChannelStatusEnabled,
		Priority: &lowPriority,
		Weight:   &lowWeight,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "standard",
		Model:     "gpt-5.4",
		ChannelId: 120,
		Enabled:   true,
		Priority:  &highPriority,
		Weight:    highWeight,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "standard",
		Model:     "gpt-5.4",
		ChannelId: 121,
		Enabled:   true,
		Priority:  &lowPriority,
		Weight:    lowWeight,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	channel, selectedGroup, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx:        ctx,
		TokenGroup: "standard",
		ModelName:  "gpt-5.4",
		Retry:      common.GetPointer(0),
	})

	require.NoError(t, err)
	require.Equal(t, "standard", selectedGroup)
	require.NotNil(t, channel)
	require.Equal(t, 121, channel.Id)
}

func TestChannelSupportsRequestEndpointAllowsBlockRunForAnthropicMessages(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	require.True(t, ChannelSupportsRequestEndpoint(ctx, &model.Channel{
		Type: constant.ChannelTypeBlockRun,
	}, "claude-sonnet-4-6"))
}

func TestChannelSupportsRequestEndpointAllowsBlockRunForResponses(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	require.True(t, ChannelSupportsRequestEndpoint(ctx, &model.Channel{
		Type: constant.ChannelTypeBlockRun,
	}, "gpt-5.4"))
}

func TestChannelSupportsRequestEndpointRejectsUnsupportedResponsesAdaptors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	require.True(t, ChannelSupportsRequestEndpoint(ctx, &model.Channel{
		Type: constant.ChannelTypeOpenAI,
	}, "gpt-5.4"))
	require.True(t, ChannelSupportsRequestEndpoint(ctx, &model.Channel{
		Type: constant.ChannelTypeCodex,
	}, "gpt-5.4"))
	require.True(t, ChannelSupportsRequestEndpoint(ctx, &model.Channel{
		Type: constant.ChannelTypeXai,
	}, "gpt-5.4"))
	require.True(t, ChannelSupportsRequestEndpoint(ctx, &model.Channel{
		Type: constant.ChannelTypeBlockRun,
	}, "gpt-5.4"))
	require.False(t, ChannelSupportsRequestEndpoint(ctx, &model.Channel{
		Type: constant.ChannelTypeAnthropic,
	}, "gpt-5.4"))
	require.False(t, ChannelSupportsRequestEndpoint(ctx, &model.Channel{
		Type: constant.ChannelTypeGemini,
	}, "gpt-5.4"))
	require.False(t, ChannelSupportsRequestEndpoint(ctx, &model.Channel{
		Type: constant.ChannelTypeAws,
	}, "gpt-5.4"))
}

func TestRequestedEndpointTypeRecognizesV1Models(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/models/gemini-2.5-flash:generateContent", nil)

	require.Equal(t, constant.EndpointTypeGemini, requestedEndpointType(ctx))
}
