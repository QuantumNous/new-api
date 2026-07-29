package controller

import (
	"net/http/httptest"
	"testing"

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

	filter, err := getLogUsageSummaryFilter(c, 0, true)
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

	_, err := getLogUsageSummaryFilter(c, 0, true)
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

	filter, err := getLogUsageSummaryFilter(c, 123, false)
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

	_, err := getLogUsageSummaryFilter(c, 0, true)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "渠道 ID")
}
