package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func withApiKeyStatsSettings(t *testing.T, selfUseModeEnabled, apiKeyStatsEnabled bool) {
	t.Helper()

	originalSelfUseModeEnabled := operation_setting.SelfUseModeEnabled
	originalApiKeyStatsEnabled := common.ApiKeyStatsEnabled
	operation_setting.SelfUseModeEnabled = selfUseModeEnabled
	common.ApiKeyStatsEnabled = apiKeyStatsEnabled
	t.Cleanup(func() {
		operation_setting.SelfUseModeEnabled = originalSelfUseModeEnabled
		common.ApiKeyStatsEnabled = originalApiKeyStatsEnabled
	})
}

func performTokenStatsRequest(handler gin.HandlerFunc) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodGet, "/api/log/stat/tokens", nil)
	ctx.Request = req
	handler(ctx)
	return recorder
}

func TestGetLogStatsByTokenRejectsWhenApiKeyStatsDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withApiKeyStatsSettings(t, true, false)

	recorder := performTokenStatsRequest(GetLogStatsByToken)

	require.Equal(t, http.StatusForbidden, recorder.Code)
	require.Contains(t, recorder.Body.String(), "api key statistics is disabled")
}

func TestGetLogStatsByTokenRejectsWhenSelfUseModeDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withApiKeyStatsSettings(t, false, true)

	recorder := performTokenStatsRequest(GetLogStatsByToken)

	require.Equal(t, http.StatusForbidden, recorder.Code)
	require.Contains(t, recorder.Body.String(), "api key statistics is disabled")
}

func TestGetLogStatsByTokenAllowsWhenEnabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withApiKeyStatsSettings(t, true, true)
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))

	recorder := performTokenStatsRequest(GetLogStatsByToken)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":true`)
}
