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
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestDistributeSpecificChannelWaitsForConcurrencyRelease(t *testing.T) {
	restoreRuntime := useMiddlewareMemoryChannelConcurrencyForTest(t)
	defer restoreRuntime()
	restoreSetting := useMiddlewareChannelConcurrencyWaitSettingForTest(t, 500*time.Millisecond, 5*time.Millisecond, 1)
	defer restoreSetting()
	restoreDB := useMiddlewareChannelSelectionDBForTest(t)
	defer restoreDB()

	channel := &model.Channel{
		Id:             930001,
		Type:           constant.ChannelTypeOpenAI,
		Key:            "sk-specific",
		Status:         common.ChannelStatusEnabled,
		Name:           "specific",
		Group:          "default",
		Models:         "gpt-specific-wait",
		MaxConcurrency: 1,
	}
	require.NoError(t, model.DB.Create(channel).Error)

	heldLease, ok, err := service.TryAcquireChannelConcurrency(context.Background(), channel)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, heldLease)
	t.Cleanup(func() {
		require.NoError(t, service.ReleaseChannelConcurrency(context.Background(), heldLease))
	})

	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyTokenSpecificChannelId, fmt.Sprintf("%d", channel.Id))
		c.Next()
	})
	router.Use(Distribute())
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	done := make(chan *httptest.ResponseRecorder, 1)
	go func() {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-specific-wait"}`))
		request.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(recorder, request)
		done <- recorder
	}()

	select {
	case recorder := <-done:
		t.Fatalf("request completed before held lease was released with status %d", recorder.Code)
	case <-time.After(30 * time.Millisecond):
	}

	require.NoError(t, service.ReleaseChannelConcurrency(context.Background(), heldLease))

	select {
	case recorder := <-done:
		require.Equal(t, http.StatusOK, recorder.Code)
	case <-time.After(time.Second):
		t.Fatal("request did not acquire channel concurrency after release")
	}
}

func TestDistributeAffinityChannelWaitsForConcurrencyRelease(t *testing.T) {
	restoreRuntime := useMiddlewareMemoryChannelConcurrencyForTest(t)
	defer restoreRuntime()
	restoreSetting := useMiddlewareChannelConcurrencyWaitSettingForTest(t, 500*time.Millisecond, 5*time.Millisecond, 1)
	defer restoreSetting()
	restoreDB := useMiddlewareChannelSelectionDBForTest(t)
	defer restoreDB()
	restoreAffinity := useMiddlewareChannelAffinityRuleForTest(t)
	defer restoreAffinity()

	priority := int64(0)
	preferredWeight := uint(1_000_000)
	fallbackWeight := uint(1)
	preferred := &model.Channel{
		Id:             930002,
		Type:           constant.ChannelTypeOpenAI,
		Key:            "sk-preferred",
		Status:         common.ChannelStatusEnabled,
		Name:           "preferred",
		Group:          "default",
		Models:         "gpt-affinity-wait",
		Priority:       &priority,
		Weight:         &preferredWeight,
		MaxConcurrency: 1,
	}
	fallback := &model.Channel{
		Id:             930003,
		Type:           constant.ChannelTypeOpenAI,
		Key:            "sk-fallback",
		Status:         common.ChannelStatusEnabled,
		Name:           "fallback",
		Group:          "default",
		Models:         "gpt-affinity-wait",
		Priority:       &priority,
		Weight:         &fallbackWeight,
		MaxConcurrency: 1,
	}
	require.NoError(t, model.DB.Create(preferred).Error)
	require.NoError(t, preferred.AddAbilities(nil))
	require.NoError(t, model.DB.Create(fallback).Error)
	require.NoError(t, fallback.AddAbilities(nil))
	model.InitChannelCache()

	affinityValue := fmt.Sprintf("affinity-%d", time.Now().UnixNano())
	seedRecorder := httptest.NewRecorder()
	seedContext, _ := gin.CreateTestContext(seedRecorder)
	seedContext.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-affinity-wait"}`))
	seedContext.Request.Header.Set("Content-Type", "application/json")
	seedContext.Request.Header.Set("X-Test-Affinity", affinityValue)
	_, found := service.GetPreferredChannelByAffinity(seedContext, "gpt-affinity-wait", "default")
	require.False(t, found)
	service.RecordChannelAffinity(seedContext, preferred.Id)

	heldLease, ok, err := service.TryAcquireChannelConcurrency(context.Background(), preferred)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, heldLease)
	t.Cleanup(func() {
		require.NoError(t, service.ReleaseChannelConcurrency(context.Background(), heldLease))
	})

	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		c.Next()
	})
	router.Use(Distribute())
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		if channelID := common.GetContextKeyInt(c, constant.ContextKeyChannelId); channelID != preferred.Id {
			c.String(http.StatusInternalServerError, "selected channel = %d, want %d", channelID, preferred.Id)
			return
		}
		c.Status(http.StatusOK)
	})

	done := make(chan *httptest.ResponseRecorder, 1)
	go func() {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-affinity-wait"}`))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("X-Test-Affinity", affinityValue)
		router.ServeHTTP(recorder, request)
		done <- recorder
	}()

	select {
	case recorder := <-done:
		t.Fatalf("request completed before affinity lease was released with status %d", recorder.Code)
	case <-time.After(30 * time.Millisecond):
	}

	require.NoError(t, service.ReleaseChannelConcurrency(context.Background(), heldLease))

	select {
	case recorder := <-done:
		require.Equal(t, http.StatusOK, recorder.Code)
	case <-time.After(time.Second):
		t.Fatal("affinity request did not acquire channel concurrency after release")
	}
}

func useMiddlewareMemoryChannelConcurrencyForTest(t *testing.T) func() {
	t.Helper()
	gin.SetMode(gin.TestMode)
	prevRDB := common.RDB
	prevRedisEnabled := common.RedisEnabled
	common.RDB = nil
	common.RedisEnabled = false
	return func() {
		common.RDB = prevRDB
		common.RedisEnabled = prevRedisEnabled
	}
}

func useMiddlewareChannelConcurrencyWaitSettingForTest(t *testing.T, timeout time.Duration, interval time.Duration, maxWaiting int) func() {
	t.Helper()
	setting := operation_setting.GetChannelConcurrencySetting()
	original := setting
	setting.WaitEnabled = true
	setting.WaitTimeoutMS = int(timeout / time.Millisecond)
	setting.WaitIntervalMS = int(interval / time.Millisecond)
	setting.MaxWaitingPerChannel = maxWaiting
	setting.CooldownEnabled = true
	operation_setting.SetChannelConcurrencySettingForTest(setting)
	return func() {
		operation_setting.SetChannelConcurrencySettingForTest(original)
	}
}

func useMiddlewareChannelSelectionDBForTest(t *testing.T) func() {
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

func useMiddlewareChannelAffinityRuleForTest(t *testing.T) func() {
	t.Helper()
	setting := operation_setting.GetChannelAffinitySetting()
	original := *setting
	setting.Enabled = true
	setting.DefaultTTLSeconds = 60
	setting.Rules = []operation_setting.ChannelAffinityRule{
		{
			Name:       fmt.Sprintf("middleware-affinity-%d", time.Now().UnixNano()),
			ModelRegex: []string{"^gpt-affinity-wait$"},
			PathRegex:  []string{"/v1/chat/completions"},
			KeySources: []operation_setting.ChannelAffinityKeySource{
				{Type: "request_header", Key: "X-Test-Affinity"},
			},
			IncludeRuleName:   true,
			IncludeModelName:  true,
			IncludeUsingGroup: true,
		},
	}
	return func() {
		*setting = original
	}
}
