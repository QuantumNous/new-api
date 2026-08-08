package controller

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetAdminModelPerfMetricsRejectsInvalidRanges(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := time.Now().Unix()
	tests := []struct {
		name  string
		query string
	}{
		{name: "missing end", query: "?start_timestamp=100"},
		{name: "non numeric", query: "?start_timestamp=bad&end_timestamp=200"},
		{name: "reversed", query: "?start_timestamp=200&end_timestamp=100"},
		{name: "future end", query: "?start_timestamp=100&end_timestamp=" + strconv.FormatInt(now+60, 10)},
		{name: "over thirty days", query: "?start_timestamp=1&end_timestamp=2592002"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			request, err := http.NewRequest(http.MethodGet, "/api/perf-metrics/admin/models"+tt.query, nil)
			require.NoError(t, err)
			ctx.Request = request

			GetAdminModelPerfMetrics(ctx)

			assert.Equal(t, http.StatusBadRequest, recorder.Code)
		})
	}
}
