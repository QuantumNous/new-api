package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetLogUsageSummaryFilterAcceptsThirtyOneDaysAndAdminFilters(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		"GET",
		"/api/log/export/summary?start_timestamp=100&end_timestamp=2678500&username=wanxin1&channel=44&group=image%262",
		nil,
	)

	filter, err := getLogUsageSummaryFilter(c, 0, true, logUsageExportRangeBound)
	require.NoError(t, err)
	assert.Equal(t, "wanxin1", filter.Username)
	assert.Equal(t, 44, filter.Channel)
	assert.Equal(t, "image&2", filter.Group)
}

func TestGetLogUsageSummaryFilterRejectsRangeOverThirtyOneDays(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		"GET",
		"/api/log/export/summary?start_timestamp=100&end_timestamp=2678501",
		nil,
	)

	_, err := getLogUsageSummaryFilter(c, 0, true, logUsageExportRangeBound)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "31 天")
}

func TestGetLogUsageSummaryFilterIgnoresAdminFieldsForSelfExport(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		"GET",
		"/api/log/self/export/summary?start_timestamp=100&end_timestamp=200&username=other&channel=44",
		nil,
	)

	filter, err := getLogUsageSummaryFilter(c, 123, false, logUsageExportRangeBound)
	require.NoError(t, err)
	assert.Equal(t, 123, filter.UserId)
	assert.Empty(t, filter.Username)
	assert.Zero(t, filter.Channel)
}

func TestGetLogUsageSummaryFilterRejectsInvalidAdminChannel(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		"GET",
		"/api/log/export/summary?start_timestamp=100&end_timestamp=200&channel=not-a-number",
		nil,
	)

	_, err := getLogUsageSummaryFilter(c, 0, true, logUsageExportRangeBound)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "渠道 ID")
}

func TestGetLogUsageAnalysisFilterDefaultsAndSelfBoundary(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		"GET",
		"/api/log/analysis?start_timestamp=100&end_timestamp=200&granularity=hour",
		nil,
	)
	filter, err := getLogUsageAnalysisFilter(c, 0, true)
	require.NoError(t, err)
	assert.Equal(t, "hour", filter.Granularity)
	assert.Equal(t, []string{"period", "model_name"}, filter.Dimensions)

	c, _ = gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		"GET",
		"/api/log/self/analysis?start_timestamp=100&end_timestamp=200",
		nil,
	)
	filter, err = getLogUsageAnalysisFilter(c, 123, false)
	require.NoError(t, err)
	assert.Equal(t, []string{"period", "model_name"}, filter.Dimensions)

	c, _ = gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		"GET",
		"/api/log/self/analysis?start_timestamp=100&end_timestamp=200&dimensions=period,model_name,channel",
		nil,
	)
	_, err = getLogUsageAnalysisFilter(c, 123, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "不允许")
}

func TestGetLogUsageAnalysisFilterRejectsUnknownDimension(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		"GET",
		"/api/log/analysis?start_timestamp=100&end_timestamp=200&dimensions=period,ip",
		nil,
	)
	_, err := getLogUsageAnalysisFilter(c, 0, true)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "不支持")
}

func TestGetLogUsageAnalysisFilterRejectsSelfAdminQueryParams(t *testing.T) {
	queries := []string{
		"start_timestamp=100&end_timestamp=200&username=other",
		"start_timestamp=100&end_timestamp=200&channel=44",
		"start_timestamp=100&end_timestamp=200&username=",
		"start_timestamp=100&end_timestamp=200&channel=",
	}
	for _, query := range queries {
		t.Run(query, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest("GET", "/api/log/self/analysis?"+query, nil)

			_, err := getLogUsageAnalysisFilter(c, 123, false)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "不允许")
		})
	}
}

// The dashboard analysis endpoint answers cross-month questions and is bounded
// by the shared, segmented dashboard policy rather than by the single-statement
// export bound. The single-shot CSV export keeps its own 31 day bound, which
// TestGetLogUsageSummaryFilterRejectsRangeOverThirtyOneDays still pins.
func TestGetLogUsageAnalysisFilterRangeBoundaryMatrix(t *testing.T) {
	const startTimestamp int64 = 1782835242 // 2026-07-01 00:00:42 Asia/Shanghai
	const day int64 = 24 * 60 * 60
	// 2026-08-05 11:07:45 Asia/Shanghai: the range moni reported as failing.
	const reportedEnd int64 = 1785899265

	tests := []struct {
		name      string
		end       int64
		wantError string
	}{
		{name: "cross month within 31 days", end: startTimestamp + 20*day},
		{name: "exactly 31 days", end: startTimestamp + 31*day},
		{name: "31 days plus one second", end: startTimestamp + 31*day + 1},
		{name: "reported 35 day range", end: reportedEnd},
		{name: "exactly 90 days", end: startTimestamp + 90*day},
		{name: "90 days plus one second", end: startTimestamp + 90*day + 1, wantError: "90 天"},
		{name: "inverted", end: startTimestamp - 1, wantError: "不能早于开始时间"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest("GET", fmt.Sprintf(
				"/api/log/analysis?start_timestamp=%d&end_timestamp=%d&granularity=hour",
				startTimestamp, test.end,
			), nil)

			filter, err := getLogUsageAnalysisFilter(c, 0, true)
			if test.wantError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), test.wantError)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.end, filter.EndTimestamp)
			assert.Equal(t, startTimestamp, filter.StartTimestamp)
		})
	}
}

// A longer range is served by more bounded segments, so the request budget
// scales with the segment count and stays capped.
func TestLogUsageAnalysisTimeoutScalesWithSegmentsAndStaysBounded(t *testing.T) {
	const startTimestamp int64 = 1782835242
	const day int64 = 24 * 60 * 60

	oneSegment := logUsageAnalysisTimeout(model.LogUsageAnalysisFilter{
		LogUsageSummaryFilter: model.LogUsageSummaryFilter{StartTimestamp: startTimestamp, EndTimestamp: startTimestamp + 31*day},
	})
	reported := logUsageAnalysisTimeout(model.LogUsageAnalysisFilter{
		LogUsageSummaryFilter: model.LogUsageSummaryFilter{StartTimestamp: startTimestamp, EndTimestamp: 1785899265},
	})
	full := logUsageAnalysisTimeout(model.LogUsageAnalysisFilter{
		LogUsageSummaryFilter: model.LogUsageSummaryFilter{StartTimestamp: startTimestamp, EndTimestamp: startTimestamp + 90*day},
	})

	assert.Equal(t, logUsageAnalysisSegmentTimeout, oneSegment)
	assert.Equal(t, 2*logUsageAnalysisSegmentTimeout, reported)
	assert.Equal(t, 3*logUsageAnalysisSegmentTimeout, full)
	assert.LessOrEqual(t, full, maxLogUsageAnalysisTimeout)
}

func TestGetLogSelfUsageAnalysisReturnsFourHundredForExplicitScopeParameters(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		"GET",
		"/api/log/self/analysis?start_timestamp=100&end_timestamp=200&username=",
		nil,
	)
	c.Set("id", 123)

	GetLogSelfUsageAnalysis(c)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, false, body["success"])
	assert.Contains(t, body["message"], "不允许")
}
