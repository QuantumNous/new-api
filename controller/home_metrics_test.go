package controller

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

func TestGetHomeRequestMetricsReturnsExplicitServerError(t *testing.T) {
	previousLogDB := model.LOG_DB
	previousEnabled := common.LogConsumeEnabled
	model.LOG_DB = nil
	common.LogConsumeEnabled = true
	t.Cleanup(func() {
		model.LOG_DB = previousLogDB
		common.LogConsumeEnabled = previousEnabled
	})

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/home/metrics", nil)
	GetHomeRequestMetrics(context)

	require.Equal(t, http.StatusInternalServerError, recorder.Code)
	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
	assert.Equal(t, "home request metrics unavailable", response.Message)
}
