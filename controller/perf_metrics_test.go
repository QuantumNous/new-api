package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPerfMetricsControllerTest(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.PerfMetric{}))
	model.DB = db

	originalGroupRatio := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"plg":0.9,"company-employees":1.2}`))

	t.Cleanup(func() {
		model.DB = originalDB
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatio))
	})
}

func insertPerfMetric(t *testing.T, metric model.PerfMetric) {
	t.Helper()
	if metric.BucketTs == 0 {
		metric.BucketTs = time.Now().Add(-time.Hour).Unix()
	}
	require.NoError(t, model.DB.Create(&metric).Error)
}

func performPerfMetricsSummaryRequest(target string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, target, nil)
	GetPerfMetricsSummary(ctx)
	return recorder
}

func performPerfMetricsRequest(target string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, target, nil)
	GetPerfMetrics(ctx)
	return recorder
}

func TestGetPerfMetricsSummaryKeepsDefaultMixedGroups(t *testing.T) {
	setupPerfMetricsControllerTest(t)
	insertPerfMetric(t, model.PerfMetric{ModelName: "gpt-plg", Group: "plg", RequestCount: 2, SuccessCount: 2, TotalLatencyMs: 200})
	insertPerfMetric(t, model.PerfMetric{ModelName: "gpt-enterprise", Group: "company-employees", RequestCount: 3, SuccessCount: 3, TotalLatencyMs: 300})

	recorder := performPerfMetricsSummaryRequest("/api/perf-metrics/summary?hours=24")

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"model_name":"gpt-plg"`)
	require.Contains(t, recorder.Body.String(), `"model_name":"gpt-enterprise"`)
}

func TestGetPerfMetricsSummaryFiltersExplicitPublicGroupToPLG(t *testing.T) {
	setupPerfMetricsControllerTest(t)
	insertPerfMetric(t, model.PerfMetric{ModelName: "gpt-plg", Group: "plg", RequestCount: 2, SuccessCount: 2, TotalLatencyMs: 200})
	insertPerfMetric(t, model.PerfMetric{ModelName: "gpt-enterprise", Group: "company-employees", RequestCount: 3, SuccessCount: 3, TotalLatencyMs: 300})

	recorder := performPerfMetricsSummaryRequest("/api/perf-metrics/summary?hours=24&group=plg")

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"model_name":"gpt-plg"`)
	require.NotContains(t, recorder.Body.String(), `"model_name":"gpt-enterprise"`)
}

func TestGetPerfMetricsSummaryRejectsUnsupportedExplicitGroup(t *testing.T) {
	setupPerfMetricsControllerTest(t)

	recorder := performPerfMetricsSummaryRequest("/api/perf-metrics/summary?hours=24&group=company-employees")

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	require.JSONEq(t, `{"success":false,"message":"unsupported performance metrics group"}`, recorder.Body.String())
}

func TestGetPerfMetricsSummaryFailsClosedWhenPublicGroupRatioMissing(t *testing.T) {
	setupPerfMetricsControllerTest(t)
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`))

	recorder := performPerfMetricsSummaryRequest("/api/perf-metrics/summary?hours=24&group=plg")

	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	require.JSONEq(t, `{"success":false,"message":"public website group is not configured"}`, recorder.Body.String())
}

func TestGetPerfMetricsFailsClosedWhenPublicGroupRatioMissing(t *testing.T) {
	setupPerfMetricsControllerTest(t)
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`))

	recorder := performPerfMetricsRequest("/api/perf-metrics?model=gpt-plg&hours=24&group=plg")

	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	require.JSONEq(t, `{"success":false,"message":"public website group is not configured"}`, recorder.Body.String())
}

func TestGetPerfMetricsRejectsUnsupportedExplicitGroup(t *testing.T) {
	setupPerfMetricsControllerTest(t)

	recorder := performPerfMetricsRequest("/api/perf-metrics?model=gpt-enterprise&hours=24&group=company-employees")

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	require.JSONEq(t, `{"success":false,"message":"unsupported performance metrics group"}`, recorder.Body.String())
}
