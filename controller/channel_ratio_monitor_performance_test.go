package controller

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
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
		RangeMinutes            int                                      `json:"range_minutes"`
		Items                   []model.ChannelMonitorPerformanceMetric  `json:"items"`
		SuccessMetricsAvailable bool                                     `json:"success_metrics_available"`
		SuccessItems            []model.ChannelMonitorSuccessMetric      `json:"success_items"`
		GroupSuccessItems       []model.ChannelMonitorGroupSuccessMetric `json:"group_success_items"`
	} `json:"data"`
}

func TestGetChannelMonitorPerformanceReturnsUsageLogMetrics(t *testing.T) {
	originalLogDB := model.LOG_DB
	originalLogDatabaseType := common.LogDatabaseType()
	originalLogConsumeEnabled := common.LogConsumeEnabled
	originalErrorLogEnabled := constant.ErrorLogEnabled
	t.Cleanup(func() {
		model.LOG_DB = originalLogDB
		common.SetLogDatabaseType(originalLogDatabaseType)
		common.LogConsumeEnabled = originalLogConsumeEnabled
		constant.ErrorLogEnabled = originalErrorLogEnabled
	})
	common.LogConsumeEnabled = true
	constant.ErrorLogEnabled = true

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
		Group:            "vip",
		CompletionTokens: 120,
		UseTime:          4,
		Other:            `{"frt":1500}`,
	}).Error)
	require.NoError(t, db.Create(&model.Log{
		ChannelId:      7,
		ModelName:      "test-model",
		CreatedAt:      time.Now().Unix(),
		Type:           model.LogTypeError,
		IsRetryAttempt: true,
		Group:          "vip",
		Content:        "status_code=503, upstream unavailable",
		Other:          `{"status_code":503,"error_type":"upstream_error","error_code":"bad_response_status_code"}`,
	}).Error)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/channel_monitor/performance?minutes=30", nil)

	GetChannelMonitorPerformance(context)

	assert.Equal(t, http.StatusOK, recorder.Code)
	var response channelMonitorPerformanceAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Equal(t, 30, response.Data.RangeMinutes)
	require.Len(t, response.Data.Items, 1)
	assert.Equal(t, 7, response.Data.Items[0].ChannelId)
	require.NotNil(t, response.Data.Items[0].AverageFirstTokenMs)
	assert.InDelta(t, 1500, *response.Data.Items[0].AverageFirstTokenMs, 0.001)
	require.NotNil(t, response.Data.Items[0].AverageTPS)
	assert.InDelta(t, 30, *response.Data.Items[0].AverageTPS, 0.001)
	assert.True(t, response.Data.SuccessMetricsAvailable)
	require.Len(t, response.Data.SuccessItems, 1)
	assert.Equal(t, int64(1), response.Data.SuccessItems[0].ActualSuccessCount)
	assert.Equal(t, int64(1), response.Data.SuccessItems[0].ActualFailureCount)
	assert.InDelta(t, 0.5, response.Data.SuccessItems[0].ActualSuccessRate, 0.001)
	assert.Equal(t, int64(1), response.Data.SuccessItems[0].FinalSampleCount)
	assert.InDelta(t, 1, response.Data.SuccessItems[0].FinalSuccessRate, 0.001)
	require.Len(t, response.Data.GroupSuccessItems, 1)
	assert.Equal(t, "vip", response.Data.GroupSuccessItems[0].Group)
	assert.InDelta(t, 0.5, response.Data.GroupSuccessItems[0].ActualSuccessRate, 0.001)
	assert.InDelta(t, 1, response.Data.GroupSuccessItems[0].FinalSuccessRate, 0.001)

	detailRecorder := httptest.NewRecorder()
	detailContext, _ := gin.CreateTestContext(detailRecorder)
	detailContext.Request = httptest.NewRequest(http.MethodGet, "/api/channel_monitor/success/detail?minutes=30&channel_id=7&model_name=test-model", nil)
	GetChannelMonitorSuccessDetail(detailContext)

	assert.Equal(t, http.StatusOK, detailRecorder.Code)
	var detailResponse struct {
		Success bool `json:"success"`
		Data    struct {
			SuccessMetricsAvailable bool                              `json:"success_metrics_available"`
			Detail                  model.ChannelMonitorSuccessDetail `json:"detail"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(detailRecorder.Body.Bytes(), &detailResponse))
	assert.True(t, detailResponse.Success)
	assert.True(t, detailResponse.Data.SuccessMetricsAvailable)
	assert.Equal(t, int64(1), detailResponse.Data.Detail.Summary.ActualFailureCount)
	require.Len(t, detailResponse.Data.Detail.FailureCategories, 1)
	assert.Equal(t, 503, detailResponse.Data.Detail.FailureCategories[0].StatusCode)
}

func TestGetChannelMonitorPerformanceRejectsInvalidRange(t *testing.T) {
	for _, minutes := range []string{"0", "1441", "invalid"} {
		t.Run(minutes, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			recorder := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(recorder)
			context.Request = httptest.NewRequest(http.MethodGet, "/api/channel_monitor/performance?minutes="+minutes, nil)

			GetChannelMonitorPerformance(context)

			assert.Equal(t, http.StatusBadRequest, recorder.Code)
			assert.Contains(t, recorder.Body.String(), "性能与成功率统计范围必须在 1 到 1440 分钟之间")
		})
	}
}
