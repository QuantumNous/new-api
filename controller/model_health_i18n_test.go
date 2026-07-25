package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestModelHealthBadRequestsAreLocalized(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name        string
		handler     gin.HandlerFunc
		target      string
		language    string
		wantMessage string
	}{
		{
			name:        "invalid hours in English",
			handler:     GetModelHealthOverview,
			target:      "/api/data/model_health?hours=48",
			language:    "en",
			wantMessage: "Hours must be one of 24, 168, or 720",
		},
		{
			name:        "invalid hours in Chinese",
			handler:     GetModelHealthOverview,
			target:      "/api/data/model_health?hours=48",
			language:    "zh-CN",
			wantMessage: "查询时长必须为 24、168 或 720 小时",
		},
		{
			name:        "required model in English",
			handler:     GetModelHealthDetail,
			target:      "/api/data/model_health/detail?hours=24",
			language:    "en",
			wantMessage: "Model is required",
		},
		{
			name:        "required model in Chinese",
			handler:     GetModelHealthDetail,
			target:      "/api/data/model_health/detail?hours=24",
			language:    "zh-CN",
			wantMessage: "必须指定模型",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, test.target, nil)
			ctx.Request.Header.Set("Accept-Language", test.language)

			test.handler(ctx)

			var response struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			require.Equal(t, http.StatusBadRequest, recorder.Code)
			require.False(t, response.Success)
			require.Equal(t, test.wantMessage, response.Message)
		})
	}
}
