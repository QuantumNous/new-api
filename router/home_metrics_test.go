package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHomeRequestMetricsRouteIsPublicAndReportsDisabledLogging(t *testing.T) {
	previousRateLimit := common.GlobalApiRateLimitEnable
	previousLogEnabled := common.LogConsumeEnabled
	common.GlobalApiRateLimitEnable = false
	common.LogConsumeEnabled = false
	t.Cleanup(func() {
		common.GlobalApiRateLimitEnable = previousRateLimit
		common.LogConsumeEnabled = previousLogEnabled
	})

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(
		recorder,
		httptest.NewRequest(http.MethodGet, "/api/home/metrics", nil),
	)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool                     `json:"success"`
		Data    model.HomeRequestMetrics `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.False(t, response.Data.Available)
	assert.Nil(t, response.Data.Requests24h)
	assert.Equal(t, make([]int64, 24), response.Data.HourlyRequests)
	assert.Positive(t, response.Data.GeneratedAt)
}
