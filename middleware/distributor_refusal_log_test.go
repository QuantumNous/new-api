package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// A distributor refusal (503 "no available channel") must land in the log
// table as a type-5 error row carrying the model and the group, in the same
// shape the relay error rows have, while a request whose group serves the
// model answers 200 and adds no error row (HIS-4837, HIS-4413).
func TestDistributeWritesErrorLogRowForNoAvailableChannel(t *testing.T) {
	require.NoError(t, i18n.Init())
	gin.SetMode(gin.TestMode)

	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousMemoryCacheEnabled := common.MemoryCacheEnabled
	previousMainDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, database.AutoMigrate(&model.User{}, &model.Log{}, &model.Channel{}, &model.Ability{}))
	model.DB, model.LOG_DB = database, database
	common.RedisEnabled = false
	common.MemoryCacheEnabled = false
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedisEnabled
		common.MemoryCacheEnabled = previousMemoryCacheEnabled
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		require.NoError(t, sqlDB.Close())
	})

	require.NoError(t, database.Create(&model.User{Id: 7, Username: "refusal-owner", Group: "paid"}).Error)

	router := gin.New()
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		c.Set("id", 7)
		c.Set("username", "refusal-owner")
		c.Set("token_name", "shadow-token")
		c.Set("token_id", 11)
		common.SetContextKey(c, constant.ContextKeyUserGroup, "paid")
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "paid")
	}, Distribute(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	post := func(body string) *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Accept-Language", "en")
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, request)
		return recorder
	}

	// A sold name no channel serves: the distributor answers 503 and must
	// also leave the proof in the log table, not only in the container log.
	refused := post(`{"model":"claude-fable-5"}`)
	assert.Equal(t, http.StatusServiceUnavailable, refused.Code)
	assert.Contains(t, refused.Body.String(), "No available channel for model claude-fable-5 under group paid (distributor)")

	var stored model.Log
	require.NoError(t, database.First(&stored).Error)
	assert.Equal(t, model.LogTypeError, stored.Type)
	assert.Equal(t, "claude-fable-5", stored.ModelName)
	assert.Equal(t, "paid", stored.Group)
	assert.Equal(t, 0, stored.ChannelId)
	assert.Equal(t, "shadow-token", stored.TokenName)
	assert.Contains(t, stored.Content, "No available channel for model claude-fable-5 under group paid (distributor)")
	assert.NotContains(t, stored.Content, "sk-")
	storedOther, err := common.StrToMap(stored.Other)
	require.NoError(t, err)
	assert.Equal(t, float64(http.StatusServiceUnavailable), storedOther["status_code"])
	assert.Equal(t, "/v1/chat/completions", storedOther["request_path"])

	// The normal round: a name the group serves answers 200 and writes no
	// second error row.
	priority := int64(0)
	require.NoError(t, database.Create(&model.Channel{Id: 1, Name: "served-upstream", Type: 1, Key: "sk-channel-key", Status: 1, Models: "claude-fable-5-1", Group: "paid", Priority: &priority}).Error)
	require.NoError(t, database.Create(&model.Ability{Group: "paid", Model: "claude-fable-5-1", ChannelId: 1, Enabled: true, Priority: &priority}).Error)

	served := post(`{"model":"claude-fable-5-1"}`)
	assert.Equal(t, http.StatusOK, served.Code)

	var errorRows int64
	require.NoError(t, database.Model(&model.Log{}).Where("type = ?", model.LogTypeError).Count(&errorRows).Error)
	assert.Equal(t, int64(1), errorRows)
}
