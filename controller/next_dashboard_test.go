package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func performNextDashboardGet(t *testing.T, target string, userID, role int, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, target, nil)
	context.Set("id", userID)
	context.Set("role", role)
	handler(context)
	return recorder
}

func TestNextDashboardStatsUseCurrentUserRealLogs(t *testing.T) {
	db := setupManageUserTestDB(t)
	timestamp := func(value string) int64 {
		parsed, err := time.Parse(time.RFC3339, value)
		require.NoError(t, err)
		return parsed.Unix()
	}
	logs := []model.Log{
		{UserId: 7, CreatedAt: timestamp("2026-07-30T05:00:00Z"), Type: model.LogTypeConsume, ModelName: "model-a", Quota: 200, PromptTokens: 5, CompletionTokens: 5, UseTime: 1},
		{UserId: 7, CreatedAt: timestamp("2026-08-01T01:00:00Z"), Type: model.LogTypeConsume, ModelName: "model-a", Quota: 100, PromptTokens: 10, CompletionTokens: 20, UseTime: 2},
		{UserId: 7, CreatedAt: timestamp("2026-08-01T02:00:00Z"), Type: model.LogTypeError, ModelName: "model-a", UseTime: 9},
		{UserId: 7, CreatedAt: timestamp("2026-08-02T03:00:00Z"), Type: model.LogTypeConsume, ModelName: "model-b", Quota: 300, PromptTokens: 40, CompletionTokens: 30, UseTime: 4},
		{UserId: 7, CreatedAt: timestamp("2026-08-02T04:00:00Z"), Type: model.LogTypeSystem, ModelName: "ignored", Quota: 999},
		{UserId: 8, CreatedAt: timestamp("2026-08-01T05:00:00Z"), Type: model.LogTypeConsume, ModelName: "other-user", Quota: 9999},
	}
	require.NoError(t, db.Create(&logs).Error)

	stats := decodeNextResponse[nextDashboardStats](t, performNextDashboardGet(
		t,
		"/api/next/dashboard/stats?range=custom&start=2026-08-01&end=2026-08-02&tz_offset=0",
		7,
		common.RoleCommonUser,
		NextGetDashboardStats,
	))
	assert.Equal(t, int64(100), stats.KPI.TotalTokens)
	assert.Equal(t, int64(400), stats.KPI.TotalQuota)
	assert.Equal(t, int64(3), stats.KPI.TotalRequests)
	assert.InDelta(t, 3, stats.KPI.AvgLatency, 0.001)
	assert.InDelta(t, 66.7, stats.KPI.SuccessRate, 0.001)
	require.NotNil(t, stats.Comparison.QuotaDelta)
	require.NotNil(t, stats.Comparison.RequestsDelta)
	assert.InDelta(t, 100, *stats.Comparison.QuotaDelta, 0.001)
	assert.InDelta(t, 200, *stats.Comparison.RequestsDelta, 0.001)
	require.Len(t, stats.Models, 2)
	assert.Equal(t, "model-b", stats.Models[0].Model)
	assert.InDelta(t, 75, stats.Models[0].Share, 0.001)
	assert.Equal(t, int64(2), stats.Models[1].Requests)
	assert.InDelta(t, 2, stats.Models[1].AvgLatency, 0.001)
	require.Len(t, stats.Hourly, 24)
	assert.Equal(t, int64(1), stats.Hourly[1].Requests)
	assert.Equal(t, int64(1), stats.Hourly[2].Requests)
	assert.Equal(t, int64(1), stats.Hourly[3].Requests)
	require.Len(t, stats.Flow, 2)
	assert.Equal(t, "2026-08-01", stats.Flow[0].Date)
	assert.Equal(t, int64(2), stats.Flow[0].Requests)
	assert.Equal(t, int64(100), stats.Flow[0].Consume)
}

func TestNextDashboardStatsUseClientTimezoneForDayAndHourBuckets(t *testing.T) {
	db := setupManageUserTestDB(t)
	timestamp := func(value string) int64 {
		parsed, err := time.Parse(time.RFC3339, value)
		require.NoError(t, err)
		return parsed.Unix()
	}
	require.NoError(t, db.Create(&[]model.Log{
		{UserId: 9, CreatedAt: timestamp("2026-08-01T15:30:00Z"), Type: model.LogTypeConsume, ModelName: "model-a", Quota: 10},
		{UserId: 9, CreatedAt: timestamp("2026-08-01T16:30:00Z"), Type: model.LogTypeConsume, ModelName: "model-a", Quota: 20},
		{UserId: 10, CreatedAt: timestamp("2026-08-01T16:45:00Z"), Type: model.LogTypeConsume, ModelName: "other-user", Quota: 999},
	}).Error)

	stats := decodeNextResponse[nextDashboardStats](t, performNextDashboardGet(
		t,
		"/api/next/dashboard/stats?range=custom&start=2026-08-01&end=2026-08-02&tz_offset=480",
		9,
		common.RoleCommonUser,
		NextGetDashboardStats,
	))

	assert.Equal(t, int64(2), stats.KPI.TotalRequests)
	assert.Equal(t, int64(30), stats.KPI.TotalQuota)
	require.Len(t, stats.Hourly, 24)
	assert.Equal(t, int64(1), stats.Hourly[0].Requests)
	assert.Equal(t, int64(1), stats.Hourly[23].Requests)
	require.Len(t, stats.Flow, 2)
	assert.Equal(t, "2026-08-01", stats.Flow[0].Date)
	assert.Equal(t, int64(1), stats.Flow[0].Requests)
	assert.Equal(t, int64(10), stats.Flow[0].Consume)
	assert.Equal(t, "2026-08-02", stats.Flow[1].Date)
	assert.Equal(t, int64(1), stats.Flow[1].Requests)
	assert.Equal(t, int64(20), stats.Flow[1].Consume)
}

func TestNextDashboardDistributionUsesCurrentUserLogs(t *testing.T) {
	db := setupManageUserTestDB(t)
	now := time.Now().UTC().Add(-time.Hour).Truncate(time.Hour)
	require.NoError(t, db.Create(&[]model.Log{
		{UserId: 11, CreatedAt: now.Unix(), Type: model.LogTypeConsume, Quota: 50, PromptTokens: 4, CompletionTokens: 6},
		{UserId: 11, CreatedAt: now.Add(time.Minute).Unix(), Type: model.LogTypeError},
		{UserId: 12, CreatedAt: now.Unix(), Type: model.LogTypeConsume, Quota: 900},
	}).Error)

	points := decodeNextResponse[[]nextDashboardDistributionPoint](t, performNextDashboardGet(
		t, "/api/next/dashboard/distribution?tz_offset=0", 11, common.RoleCommonUser, NextGetDashboardDistribution,
	))
	require.Len(t, points, 1)
	assert.Equal(t, int64(2), points[0].Requests)
	assert.Equal(t, int64(50), points[0].Consume)
	assert.Equal(t, int64(10), points[0].Tokens)
}

func TestNextDashboardSystemStatusLeavesUnavailableFieldsNull(t *testing.T) {
	response := decodeNextResponse[nextDashboardSystemStatus](t, performNextDashboardGet(
		t,
		"/api/next/dashboard/system-status",
		99,
		common.RoleCommonUser,
		NextGetDashboardSystemStatus,
	))
	assert.Nil(t, response.CPUPercent)
	assert.Nil(t, response.MemoryUsedGB)
	assert.Nil(t, response.BandwidthUpMbps)
	assert.Nil(t, response.BandwidthSeries)
	assert.Nil(t, response.APISuccessRate)
}

func TestBuildNextDashboardSystemStatusReturnsAvailableApplicationTraffic(t *testing.T) {
	successRate := 99.5
	response := buildNextDashboardSystemStatus(common.SystemStatus{
		CPUUsage:         4.627,
		CPUAvailable:     true,
		MemoryAvailable:  true,
		MemoryUsedBytes:  2 << 30,
		MemoryTotalBytes: 4 << 30,
		DiskAvailable:    true,
		DiskUsedBytes:    8 << 30,
		DiskTotalBytes:   16 << 30,
		Network: common.NetworkBandwidth{
			Available:  true,
			UpMbps:     1.25,
			DownMbps:   6.5,
			UpSeries:   []float64{0, 1.25},
			DownSeries: []float64{0, 6.5},
		},
	}, &successRate)

	require.NotNil(t, response.CPUPercent)
	require.NotNil(t, response.BandwidthUpMbps)
	require.NotNil(t, response.BandwidthDownMbps)
	require.NotNil(t, response.BandwidthSeries)
	assert.InDelta(t, 4.627, *response.CPUPercent, 0.0001)
	assert.InDelta(t, 1.25, *response.BandwidthUpMbps, 0.0001)
	assert.InDelta(t, 6.5, *response.BandwidthDownMbps, 0.0001)
	assert.Equal(t, []float64{0, 1.25}, response.BandwidthSeries.Up)
	assert.Equal(t, []float64{0, 6.5}, response.BandwidthSeries.Down)
	assert.Equal(t, &successRate, response.APISuccessRate)
}

func TestNextAdminDashboardRoutesExposeOnlyPersistedMetrics(t *testing.T) {
	db := setupManageUserTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Channel{}))
	priority := int64(20)
	weight := uint(30)
	channel := model.Channel{
		Name: "real-channel", Type: 1, Key: "secret", Status: common.ChannelStatusEnabled,
		Priority: &priority, Weight: &weight, ResponseTime: 420, Balance: 12.5,
	}
	require.NoError(t, db.Create(&channel).Error)

	routes := decodeNextResponse[[]nextAdminDashboardRoute](t, performNextDashboardGet(
		t, "/api/next/admin/dashboard/routes", 99, common.RoleRootUser, NextGetAdminDashboardRoutes,
	))
	require.Len(t, routes, 1)
	assert.Equal(t, channel.Id, routes[0].ID)
	assert.Equal(t, 420, routes[0].Latency)
	assert.InDelta(t, 12.5, routes[0].Quota, 0.001)
	assert.Equal(t, weight, routes[0].Weight)
	assert.Equal(t, priority, routes[0].Priority)

	var raw nextTestResponse[[]map[string]interface{}]
	recorder := performNextDashboardGet(t, "/api/next/admin/dashboard/routes", 99, common.RoleRootUser, NextGetAdminDashboardRoutes)
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &raw))
	require.Len(t, raw.Data, 1)
	assert.NotContains(t, raw.Data[0], "health")
	assert.NotContains(t, raw.Data[0], "healthChecks")
	assert.NotContains(t, raw.Data[0], "upstreamMult")
	assert.NotContains(t, raw.Data[0], "channelMult")
}
