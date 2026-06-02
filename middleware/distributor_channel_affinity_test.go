package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupDistributorChannelAffinityTestDB(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalRedisEnabled := common.RedisEnabled
	originalMemoryCacheEnabled := common.MemoryCacheEnabled

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	common.MemoryCacheEnabled = true

	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))

	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.RedisEnabled = originalRedisEnabled
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
	})
}

func insertDistributorAffinityChannel(t *testing.T, id int, name string, status int) {
	t.Helper()

	priority := int64(10)
	weight := uint(100)
	channel := &model.Channel{
		Id:       id,
		Type:     constant.ChannelTypeOpenAI,
		Key:      fmt.Sprintf("sk-test-%d", id),
		Status:   status,
		Name:     name,
		Weight:   &weight,
		Models:   "gpt-5.5",
		Group:    "default",
		Priority: &priority,
	}
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "default",
		Model:     "gpt-5.5",
		ChannelId: id,
		Enabled:   status == common.ChannelStatusEnabled,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
}

func buildDistributorAffinityRequest(affinityValue string) *http.Request {
	body := fmt.Sprintf(`{"model":"gpt-5.5","prompt_cache_key":"%s"}`, affinityValue)
	request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	return request
}

func seedDistributorAffinityCache(t *testing.T, affinityValue string, channelID int) {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = buildDistributorAffinityRequest(affinityValue)

	_, found := service.GetPreferredChannelByAffinity(ctx, "gpt-5.5", "default")
	require.False(t, found)
	service.RecordChannelAffinity(ctx, channelID)

	cachedChannelID, found, err := getDistributorAffinityCache(t, affinityValue)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, channelID, cachedChannelID)
}

func getDistributorAffinityCache(t *testing.T, affinityValue string) (int, bool, error) {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = buildDistributorAffinityRequest(affinityValue)
	channelID, found := service.GetPreferredChannelByAffinity(ctx, "gpt-5.5", "default")
	return channelID, found, nil
}

func TestDistributeClearsDisabledAffinityAndSelectsAvailableChannel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	require.NoError(t, i18n.Init())
	setupDistributorChannelAffinityTestDB(t)
	service.ClearChannelAffinityCacheAll()
	t.Cleanup(func() {
		service.ClearChannelAffinityCacheAll()
	})

	insertDistributorAffinityChannel(t, 101, "disabled affinity", common.ChannelStatusManuallyDisabled)
	insertDistributorAffinityChannel(t, 202, "enabled fallback", common.ChannelStatusEnabled)
	model.InitChannelCache()

	setting := operation_setting.GetChannelAffinitySetting()
	originalEnabled := setting.Enabled
	originalSwitchOnSuccess := setting.SwitchOnSuccess
	t.Cleanup(func() {
		setting.Enabled = originalEnabled
		setting.SwitchOnSuccess = originalSwitchOnSuccess
	})
	setting.Enabled = true
	setting.SwitchOnSuccess = true

	affinityValue := fmt.Sprintf("disabled-affinity-%d", time.Now().UnixNano())
	seedDistributorAffinityCache(t, affinityValue, 101)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		c.Next()
	})
	router.POST("/v1/responses", Distribute(), func(c *gin.Context) {
		_, found, err := getDistributorAffinityCache(t, affinityValue)
		require.NoError(t, err)
		require.False(t, found)
		c.JSON(http.StatusOK, gin.H{"channel_id": c.GetInt("channel_id")})
	})

	recorder := httptest.NewRecorder()
	request := buildDistributorAffinityRequest(affinityValue)

	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.JSONEq(t, `{"channel_id":202}`, recorder.Body.String())

	cachedChannelID, found, err := getDistributorAffinityCache(t, affinityValue)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, 202, cachedChannelID)
}
