package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetUserSavingsSummaryLocalizesInvalidTimeRange(t *testing.T) {
	require.NoError(t, i18n.Init())
	tests := []struct {
		name     string
		language string
		expected string
	}{
		{name: "English", language: "en", expected: "Start and end times are required"},
		{name: "Chinese", language: "zh-CN", expected: "必须传入开始和结束时间"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/savings/summary", nil)
			ctx.Request.Header.Set("Accept-Language", tt.language)

			GetUserSavingsSummary(ctx)

			var response struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
			require.NoError(t, common.DecodeJson(recorder.Body, &response))
			assert.Equal(t, http.StatusBadRequest, recorder.Code)
			assert.False(t, response.Success)
			assert.Equal(t, tt.expected, response.Message)
		})
	}
}

func TestGetUserSavingsTrendRejectsMissingUTCOffset(t *testing.T) {
	require.NoError(t, i18n.Init())
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodGet,
		"/api/user/savings/trend?start_timestamp=1&end_timestamp=2&granularity=day",
		nil,
	)

	GetUserSavingsTrend(ctx)

	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.DecodeJson(recorder.Body, &response))
	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.False(t, response.Success)
	assert.Equal(t, "UTC offset is required", response.Message)
}
