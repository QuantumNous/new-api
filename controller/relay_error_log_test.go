package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestProcessChannelErrorPersistsRetryAttempt(t *testing.T) {
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalErrorLogEnabled := constant.ErrorLogEnabled
	originalRedisEnabled := common.RedisEnabled
	originalLogDatabaseType := common.LogDatabaseType()
	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		constant.ErrorLogEnabled = originalErrorLogEnabled
		common.RedisEnabled = originalRedisEnabled
		common.SetLogDatabaseType(originalLogDatabaseType)
	})

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "logs.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	require.NoError(t, db.Exec("CREATE TABLE users (id INTEGER PRIMARY KEY, setting TEXT, deleted_at DATETIME)").Error)
	require.NoError(t, db.Exec("INSERT INTO users (id, setting) VALUES (?, ?)", 1, "{}").Error)
	model.DB = db
	model.LOG_DB = db
	constant.ErrorLogEnabled = true
	common.RedisEnabled = false
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set("id", 1)
	c.Set("username", "user")
	c.Set("token_name", "test-token")
	c.Set("original_model", "gpt-test")
	c.Set("token_id", 7)
	c.Set("group", "default")
	c.Set("channel_id", 9)
	c.Set("channel_name", "test-channel")
	c.Set("channel_type", 1)
	c.Set("use_channel", []string{"9"})
	c.Set(common.RequestIdKey, "retry-request")
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "vip")
	common.SetContextKey(c, constant.ContextKeyAutoGroup, "standard")

	apiErr := types.NewOpenAIError(errors.New("temporary upstream failure"), types.ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable)
	processChannelError(c, *types.NewChannelError(9, 1, "test-channel", false, "", false), apiErr, true)

	var logs []model.Log
	require.NoError(t, db.Find(&logs).Error)
	require.Len(t, logs, 1)
	assert.True(t, logs[0].IsRetryAttempt)
	assert.Equal(t, "standard", logs[0].Group)
	assert.Contains(t, logs[0].Content, "temporary upstream failure")
}
