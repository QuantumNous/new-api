package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func performModelHealthRequest(handler gin.HandlerFunc, target string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, target, nil)
	handler(ctx)
	return recorder
}

func TestParseModelHealthHoursDefaultsMissingHoursToTwentyFour(t *testing.T) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/data/model_health", nil)

	hours, ok := parseModelHealthHours(ctx)

	require.True(t, ok)
	require.Equal(t, 24, hours)
}

func TestGetModelHealthOverviewRejectsUnsupportedHours(t *testing.T) {
	for _, hours := range []string{"0", "23", "25", "167", "169", "719", "721", "abc"} {
		t.Run(hours, func(t *testing.T) {
			recorder := performModelHealthRequest(GetModelHealthOverview, "/api/data/model_health?hours="+hours)

			require.Equal(t, http.StatusBadRequest, recorder.Code)
		})
	}
}

func TestGetModelHealthDetailRejectsMissingModel(t *testing.T) {
	recorder := performModelHealthRequest(GetModelHealthDetail, "/api/data/model_health/detail?hours=24")

	require.Equal(t, http.StatusBadRequest, recorder.Code)
}

func TestGetModelHealthDetailRejectsBlankModel(t *testing.T) {
	recorder := performModelHealthRequest(GetModelHealthDetail, "/api/data/model_health/detail?model=%20%20&hours=24")

	require.Equal(t, http.StatusBadRequest, recorder.Code)
}

func TestGetModelHealthDetailRejectsUnsupportedHours(t *testing.T) {
	recorder := performModelHealthRequest(GetModelHealthDetail, "/api/data/model_health/detail?model=gpt-4o&hours=48")

	require.Equal(t, http.StatusBadRequest, recorder.Code)
}

func TestGetModelHealthOverviewReturnsSuccessfulJSONEnvelope(t *testing.T) {
	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.PerfMetric{}))
	model.DB = db
	t.Cleanup(func() { model.DB = originalDB })

	bucketSeconds := perf_metrics_setting.GetBucketSeconds()
	cutoff := perfmetrics.ModelHealthDataCutoff(time.Now().Unix(), bucketSeconds, perf_metrics_setting.GetFlushIntervalMinutes())
	require.NoError(t, model.DB.Create(&model.PerfMetric{ModelName: "http-model", Group: "default", BucketTs: cutoff - bucketSeconds, RequestCount: 20, SuccessCount: 20}).Error)

	recorder := performModelHealthRequest(GetModelHealthOverview, "/api/data/model_health?hours=24")

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope struct {
		Success bool `json:"success"`
		Data    struct {
			RequestedHours int `json:"requested_hours"`
			Fleet          struct {
				RequestCount int64 `json:"request_count"`
			} `json:"fleet"`
			Models []struct {
				ModelName string   `json:"model_name"`
				AvgTtftMs *float64 `json:"avg_ttft_ms"`
				AvgTps    *float64 `json:"avg_tps"`
			} `json:"models"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	require.True(t, envelope.Success)
	require.Equal(t, 24, envelope.Data.RequestedHours)
	require.Equal(t, int64(20), envelope.Data.Fleet.RequestCount)
	require.Len(t, envelope.Data.Models, 1)
	require.Equal(t, "http-model", envelope.Data.Models[0].ModelName)
	require.Nil(t, envelope.Data.Models[0].AvgTtftMs)
	require.Nil(t, envelope.Data.Models[0].AvgTps)
}
