package controller

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type channelMonitorPerformanceAPIResponse struct {
	Success bool `json:"success"`
	Data    struct {
		RangeMinutes int                                     `json:"range_minutes"`
		Items        []model.ChannelMonitorPerformanceMetric `json:"items"`
	} `json:"data"`
}

func TestGetChannelMonitorPerformanceReturnsUsageLogMetrics(t *testing.T) {
	originalLogDB := model.LOG_DB
	originalLogDatabaseType := common.LogDatabaseType()
	t.Cleanup(func() {
		model.LOG_DB = originalLogDB
		common.SetLogDatabaseType(originalLogDatabaseType)
	})

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "performance-api.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	model.LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	require.NoError(t, db.Create(&model.Log{
		ChannelId:        7,
		ModelName:        "test-model",
		CreatedAt:        time.Now().Unix(),
		Type:             model.LogTypeConsume,
		IsStream:         true,
		CompletionTokens: 120,
		UseTime:          4,
		Other:            `{"frt":1500}`,
	}).Error)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/channel_monitor/performance?minutes=15", nil)

	GetChannelMonitorPerformance(context)

	assert.Equal(t, http.StatusOK, recorder.Code)
	var response channelMonitorPerformanceAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Equal(t, 15, response.Data.RangeMinutes)
	require.Len(t, response.Data.Items, 1)
	assert.Equal(t, 7, response.Data.Items[0].ChannelId)
	require.NotNil(t, response.Data.Items[0].AverageFirstTokenMs)
	assert.InDelta(t, 1500, *response.Data.Items[0].AverageFirstTokenMs, 0.001)
	require.NotNil(t, response.Data.Items[0].AverageTPS)
	assert.InDelta(t, 30, *response.Data.Items[0].AverageTPS, 0.001)
}

func TestGetChannelMonitorPerformanceRejectsUnsupportedRange(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/channel_monitor/performance?minutes=30", nil)

	GetChannelMonitorPerformance(context)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "性能统计仅支持")
}
