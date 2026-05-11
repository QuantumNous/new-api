package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupDistributorAffinityTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	gin.SetMode(gin.TestMode)
	common.MemoryCacheEnabled = true
	common.RedisEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	service.ClearChannelAffinityCacheAll()

	t.Cleanup(func() {
		service.ClearChannelAffinityCacheAll()
		_ = db.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&model.Ability{}).Error
		_ = db.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&model.Channel{}).Error
		model.InitChannelCache()

		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.RedisEnabled = originalRedisEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		if originalMemoryCacheEnabled && originalDB != nil {
			model.InitChannelCache()
		}
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func seedDistributorAffinityChannel(t *testing.T, db *gorm.DB, name string, status int, priority int64) *model.Channel {
	t.Helper()
	return seedDistributorAffinityChannelForModel(t, db, name, status, priority, "gpt-5")
}

func seedDistributorAffinityChannelForModel(t *testing.T, db *gorm.DB, name string, status int, priority int64, modelName string) *model.Channel {
	t.Helper()

	weight := uint(100)
	autoBan := 1
	baseURL := "https://example.com"
	channel := &model.Channel{
		Type:     constant.ChannelTypeOpenAI,
		Key:      "sk-" + name,
		Status:   status,
		Name:     name,
		Weight:   &weight,
		BaseURL:  &baseURL,
		Models:   modelName,
		Group:    "default",
		Priority: &priority,
		AutoBan:  &autoBan,
	}
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     modelName,
		ChannelId: channel.Id,
		Enabled:   status == common.ChannelStatusEnabled,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
	return channel
}

func buildAffinityRequestContext(t *testing.T, body string) *gin.Context {
	t.Helper()

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	return ctx
}

func serveAffinityResponsesRequest(t *testing.T, body string) (int, int) {
	t.Helper()

	var selectedChannelID int
	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, false)
		c.Next()
	})
	router.POST("/v1/responses", Distribute(), func(c *gin.Context) {
		selectedChannelID = common.GetContextKeyInt(c, constant.ContextKeyChannelId)
		c.Status(http.StatusOK)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)
	return recorder.Code, selectedChannelID
}

func TestDistributeInvalidatesDisabledAffinityChannelAndReselects(t *testing.T) {
	db := setupDistributorAffinityTestDB(t)

	disabled := seedDistributorAffinityChannel(t, db, "affinity-disabled", common.ChannelStatusManuallyDisabled, 100)
	available := seedDistributorAffinityChannel(t, db, "affinity-available", common.ChannelStatusEnabled, 90)
	model.InitChannelCache()

	body := `{"model":"gpt-5","prompt_cache_key":"affinity-session-disabled"}`
	bindCtx := buildAffinityRequestContext(t, body)
	_, found := service.GetPreferredChannelByAffinity(bindCtx, "gpt-5", "default")
	require.False(t, found)
	service.RecordChannelAffinity(bindCtx, disabled.Id)

	checkCtx := buildAffinityRequestContext(t, body)
	cachedChannelID, found := service.GetPreferredChannelByAffinity(checkCtx, "gpt-5", "default")
	require.True(t, found)
	require.Equal(t, disabled.Id, cachedChannelID)

	statusCode, selectedChannelID := serveAffinityResponsesRequest(t, body)
	require.Equal(t, http.StatusOK, statusCode)
	require.Equal(t, available.Id, selectedChannelID)

	refreshedCtx := buildAffinityRequestContext(t, body)
	cachedChannelID, found = service.GetPreferredChannelByAffinity(refreshedCtx, "gpt-5", "default")
	require.True(t, found)
	require.Equal(t, available.Id, cachedChannelID)
}

func TestDistributeInvalidatesModelMismatchedAffinityChannelAndReselects(t *testing.T) {
	db := setupDistributorAffinityTestDB(t)

	mismatched := seedDistributorAffinityChannelForModel(t, db, "affinity-gpt5", common.ChannelStatusEnabled, 100, "gpt-5")
	available := seedDistributorAffinityChannelForModel(t, db, "affinity-gpt4", common.ChannelStatusEnabled, 90, "gpt-4")
	model.InitChannelCache()

	cacheBody := `{"model":"gpt-5","prompt_cache_key":"affinity-session-model-mismatch"}`
	bindCtx := buildAffinityRequestContext(t, cacheBody)
	_, found := service.GetPreferredChannelByAffinity(bindCtx, "gpt-5", "default")
	require.False(t, found)
	service.RecordChannelAffinity(bindCtx, mismatched.Id)

	requestBody := `{"model":"gpt-4","prompt_cache_key":"affinity-session-model-mismatch"}`
	checkCtx := buildAffinityRequestContext(t, requestBody)
	cachedChannelID, found := service.GetPreferredChannelByAffinity(checkCtx, "gpt-4", "default")
	require.True(t, found)
	require.Equal(t, mismatched.Id, cachedChannelID)

	statusCode, selectedChannelID := serveAffinityResponsesRequest(t, requestBody)
	require.Equal(t, http.StatusOK, statusCode)
	require.Equal(t, available.Id, selectedChannelID)

	refreshedCtx := buildAffinityRequestContext(t, requestBody)
	cachedChannelID, found = service.GetPreferredChannelByAffinity(refreshedCtx, "gpt-4", "default")
	require.True(t, found)
	require.Equal(t, available.Id, cachedChannelID)
}
