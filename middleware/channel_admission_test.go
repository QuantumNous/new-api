package middleware

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	appI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
	"gorm.io/gorm"
)

func TestDistributorRejectsSaturatedSpecificChannelBeforeDownstream(t *testing.T) {
	require.NoError(t, appI18n.Init())
	dsn := fmt.Sprintf("file:distributor-specific-admission-%d?mode=memory&cache=shared", time.Now().UnixNano())
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
		if previousMemoryCache && previousDB != nil {
			model.InitChannelCache()
		}
	})

	priority := int64(0)
	weight := uint(1)
	channel := &model.Channel{
		Id:       501,
		Name:     "specific",
		Type:     constant.ChannelTypeOpenAI,
		Key:      "test-key",
		Status:   common.ChannelStatusEnabled,
		Models:   "gpt-test",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}
	channel.SetSetting(dto.ChannelSettings{MaxConcurrency: 1})
	require.NoError(t, db.Create(channel).Error)

	activeLease, decision, err := service.AcquireChannelAdmission(context.Background(), channel)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	activeLease.Commit()
	defer func() { require.NoError(t, activeLease.Release()) }()

	gin.SetMode(gin.TestMode)
	downstreamCalled := false
	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyTokenSpecificChannelId, "501")
		c.Next()
	})
	router.Use(Distribute())
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		downstreamCalled = true
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-test"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusTooManyRequests, response.Code)
	assert.Equal(t, "1", response.Header().Get("Retry-After"))
	assert.Equal(t, "channel_capacity_exhausted", gjson.Get(response.Body.String(), "error.code").String())
	assert.False(t, downstreamCalled)
}

func TestDistributorRejectsNonStringSpecificChannelID(t *testing.T) {
	require.NoError(t, appI18n.Init())
	gin.SetMode(gin.TestMode)
	downstreamCalled := false
	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyTokenSpecificChannelId, 501)
		c.Next()
	})
	router.Use(Distribute())
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		downstreamCalled = true
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-test"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusBadRequest, response.Code)
	assert.False(t, downstreamCalled)
}

func TestDistributorReleasesAdmissionAcrossDownstreamExitPaths(t *testing.T) {
	require.NoError(t, appI18n.Init())
	dsn := fmt.Sprintf("file:distributor-lifecycle-admission-%d?mode=memory&cache=shared", time.Now().UnixNano())
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
		if previousMemoryCache && previousDB != nil {
			model.InitChannelCache()
		}
	})

	priority := int64(0)
	weight := uint(1)
	channel := &model.Channel{
		Id:       504,
		Name:     "lifecycle",
		Type:     constant.ChannelTypeOpenAI,
		Key:      "test-key",
		Status:   common.ChannelStatusEnabled,
		Models:   "gpt-test",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}
	channel.SetSetting(dto.ChannelSettings{MaxConcurrency: 1})
	require.NoError(t, db.Create(channel).Error)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyTokenSpecificChannelId, "504")
		c.Next()
	})
	router.Use(Distribute())
	var cancelDownstream context.CancelFunc
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		lease := service.GetChannelAdmissionLease(c)
		require.NotNil(t, lease)
		lease.Commit()
		switch c.GetHeader("X-Test-Exit") {
		case "error":
			c.Status(http.StatusBadGateway)
		case "cancel":
			cancelDownstream()
			<-c.Request.Context().Done()
			c.Status(499)
		case "timeout":
			<-c.Request.Context().Done()
			c.Status(499)
		case "stream":
			c.Header("Content-Type", "text/event-stream")
			_, _ = c.Writer.WriteString("data: done\n\n")
		case "panic":
			panic("test downstream panic")
		default:
			c.Status(http.StatusNoContent)
		}
	})

	tests := []struct {
		name       string
		exit       string
		wantStatus int
		context    func() (context.Context, context.CancelFunc)
	}{
		{name: "success", wantStatus: http.StatusNoContent},
		{name: "upstream error", exit: "error", wantStatus: http.StatusBadGateway},
		{name: "cancellation", exit: "cancel", wantStatus: 499, context: func() (context.Context, context.CancelFunc) {
			ctx, cancel := context.WithCancel(context.Background())
			cancelDownstream = cancel
			return ctx, cancel
		}},
		{name: "timeout", exit: "timeout", wantStatus: 499, context: func() (context.Context, context.CancelFunc) {
			return context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
		}},
		{name: "stream end", exit: "stream", wantStatus: http.StatusOK},
		{name: "panic", exit: "panic", wantStatus: http.StatusInternalServerError},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			requestContext := context.Background()
			cancel := func() {}
			if test.context != nil {
				requestContext, cancel = test.context()
			}
			defer cancel()

			request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-test"}`)).WithContext(requestContext)
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("X-Test-Exit", test.exit)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			assert.Equal(t, test.wantStatus, response.Code)
			snapshot, snapshotErr := service.GetChannelAdmissionSnapshot(context.Background(), channel)
			require.NoError(t, snapshotErr)
			assert.Equal(t, 0, snapshot.CurrentConcurrency)
		})
	}
}

func TestDistributorAllowsRoutesThatResolveTheirChannelDownstream(t *testing.T) {
	gin.SetMode(gin.TestMode)
	downstreamCalled := false
	originalModelSet := false
	router := gin.New()
	router.Use(Distribute())
	router.GET("/suno/fetch/:id", func(c *gin.Context) {
		downstreamCalled = true
		_, originalModelSet = c.Get(string(constant.ContextKeyOriginalModel))
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/suno/fetch/task-1", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusNoContent, response.Code)
	assert.True(t, downstreamCalled)
	assert.True(t, originalModelSet)
}

func TestDistributorRejectsSaturatedAffinityAndPreservesBinding(t *testing.T) {
	require.NoError(t, appI18n.Init())
	dsn := fmt.Sprintf("file:distributor-reroute-admission-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))

	previousDB := model.DB
	previousMemoryCache := common.MemoryCacheEnabled
	previousRedisEnabled := common.RedisEnabled
	model.DB = db
	common.MemoryCacheEnabled = true
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = previousDB
		common.MemoryCacheEnabled = previousMemoryCache
		common.RedisEnabled = previousRedisEnabled
		if previousMemoryCache && previousDB != nil {
			model.InitChannelCache()
		}
	})

	priority := int64(10)
	weight := uint(1)
	channels := []model.Channel{
		{Id: 502, Name: "full", Type: constant.ChannelTypeOpenAI, Key: "full-key", Status: common.ChannelStatusEnabled, Models: "gpt-test", Group: "default", Priority: &priority, Weight: &weight},
		{Id: 503, Name: "available", Type: constant.ChannelTypeOpenAI, Key: "available-key", Status: common.ChannelStatusEnabled, Models: "gpt-test", Group: "default", Priority: &priority, Weight: &weight},
	}
	for index := range channels {
		channels[index].SetSetting(dto.ChannelSettings{MaxConcurrency: 1})
		require.NoError(t, db.Create(&channels[index]).Error)
		require.NoError(t, db.Create(&model.Ability{
			Group:     "default",
			Model:     "gpt-test",
			ChannelId: channels[index].Id,
			Enabled:   true,
			Priority:  &priority,
			Weight:    weight,
		}).Error)
	}
	model.InitChannelCache()
	service.ClearChannelAffinityCacheAll()
	t.Cleanup(func() { service.ClearChannelAffinityCacheAll() })

	requestBody := `{"model":"gpt-test","prompt_cache_key":"sticky-capacity-test"}`
	seedResponse := httptest.NewRecorder()
	seedContext, _ := gin.CreateTestContext(seedResponse)
	seedContext.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(requestBody))
	seedContext.Request.Header.Set("Content-Type", "application/json")
	_, found := service.GetPreferredChannelByAffinity(seedContext, "gpt-test", "default")
	require.False(t, found)
	service.RecordChannelAffinity(seedContext, channels[0].Id)

	activeLease, decision, err := service.AcquireChannelAdmission(context.Background(), &channels[0])
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	activeLease.Commit()
	defer func() { require.NoError(t, activeLease.Release()) }()

	gin.SetMode(gin.TestMode)
	downstreamCalled := false
	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		c.Next()
	})
	router.Use(Distribute())
	router.POST("/v1/responses", func(c *gin.Context) {
		downstreamCalled = true
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(requestBody))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusTooManyRequests, response.Code)
	assert.Equal(t, "channel_capacity_exhausted", gjson.Get(response.Body.String(), "error.code").String())
	assert.False(t, downstreamCalled)
	checkResponse := httptest.NewRecorder()
	checkContext, _ := gin.CreateTestContext(checkResponse)
	checkContext.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(requestBody))
	checkContext.Request.Header.Set("Content-Type", "application/json")
	preferredChannelID, found := service.GetPreferredChannelByAffinity(checkContext, "gpt-test", "default")
	require.True(t, found)
	assert.Equal(t, 502, preferredChannelID)

	fullSnapshot, err := service.GetChannelAdmissionSnapshot(context.Background(), &channels[0])
	require.NoError(t, err)
	availableSnapshot, err := service.GetChannelAdmissionSnapshot(context.Background(), &channels[1])
	require.NoError(t, err)
	assert.Equal(t, 1, fullSnapshot.CurrentConcurrency)
	assert.Equal(t, 0, availableSnapshot.CurrentConcurrency)
}
