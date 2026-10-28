package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRealtimeUsageControllerTest(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousMainDatabaseType, previousLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedisEnabled
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
	})
	return db
}

func TestGetRealtimeUsersAdminSnapshotContract(t *testing.T) {
	db := setupRealtimeUsageControllerTest(t)
	now := time.Now().Unix()
	require.NoError(t, db.Create(&model.Log{UserId: 7, Username: "alice", CreatedAt: now, Type: model.LogTypeConsume, PromptTokens: 3, CompletionTokens: 2}).Error)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/dashboard/realtime-users", func(c *gin.Context) { c.Set("id", 1); GetRealtimeUsers(c) })
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/dashboard/realtime-users?window_seconds=60&trend_minutes=5&limit=5", nil))

	require.Equal(t, http.StatusOK, response.Code)
	var body struct {
		Success bool `json:"success"`
		Data    struct {
			Summary    model.RealtimeUsageSummary         `json:"summary"`
			Users      []model.RealtimeUsageUser          `json:"users"`
			Trend      []model.RealtimeUsageTrend         `json:"trend"`
			UserTrends map[int][]model.RealtimeUsageTrend `json:"user_trends"`
			UpdatedAt  int64                              `json:"updated_at"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.True(t, body.Success)
	assert.Equal(t, 1, body.Data.Summary.ActiveUsers)
	assert.Equal(t, 5, body.Data.Summary.TotalTokens)
	require.Len(t, body.Data.Users, 1)
	assert.Equal(t, "alice", body.Data.Users[0].Username)
	assert.NotEmpty(t, body.Data.Trend)
	assert.NotEmpty(t, body.Data.UserTrends[7])
	assert.Equal(t, now, body.Data.UpdatedAt)
}

func TestRealtimeUsersCommonUserForbidden(t *testing.T) {
	db := setupRealtimeUsageControllerTest(t)
	token := "common-realtime-token"
	user := &model.User{Username: "common", Password: "placeholder", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", AccessToken: &token, AuthVersion: 1}
	require.NoError(t, db.Create(user).Error)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/dashboard/realtime-users", middleware.AdminAuth(), GetRealtimeUsers)
	request := httptest.NewRequest(http.MethodGet, "/api/dashboard/realtime-users", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Equal(t, http.StatusForbidden, response.Code)
	assert.Contains(t, response.Body.String(), "AUTH_INSUFFICIENT_PRIVILEGE")
}
