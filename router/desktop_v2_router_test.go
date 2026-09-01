package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newDesktopV2TestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	registerDesktopRoutes(router.Group("/api"))
	return router
}

func TestDesktopV2BootstrapAdvertisesExistingOwnersWithoutChangingV1(t *testing.T) {
	previousAddress := system_setting.ServerAddress
	previousRedis := common.RedisEnabled
	previousClient := common.RDB
	system_setting.ServerAddress = "https://yeschoy.com/"
	common.RedisEnabled = false
	common.RDB = nil
	t.Cleanup(func() {
		system_setting.ServerAddress = previousAddress
		common.RedisEnabled = previousRedis
		common.RDB = previousClient
	})

	router := newDesktopV2TestRouter()
	v1 := httptest.NewRecorder()
	router.ServeHTTP(v1, httptest.NewRequest(http.MethodGet, desktopBootstrapPath, nil))
	require.Equal(t, http.StatusOK, v1.Code)
	assert.JSONEq(t, string(desktopBootstrapFixture(t)), v1.Body.String())

	v2 := httptest.NewRecorder()
	router.ServeHTTP(v2, httptest.NewRequest(http.MethodGet, "/api/desktop/v2/bootstrap", nil))
	require.Equal(t, http.StatusOK, v2.Code)
	assert.Contains(t, v2.Body.String(), `"contract_id":"desktop-integration-v2"`)
	assert.Contains(t, v2.Body.String(), `"minimum_client_version":"0.2.0"`)
	assert.Contains(t, v2.Body.String(), `"device_authorization_available":false`)
	assert.Contains(t, v2.Body.String(), `"official_usd_cny_rate":6.75`)
	assert.Contains(t, v2.Body.String(), `"wallet_url":"https://yeschoy.com/wallet/"`)
}

func TestDesktopV2SensitiveRoutesRequireExpectedAuthority(t *testing.T) {
	previousRedis := common.RedisEnabled
	previousClient := common.RDB
	common.RedisEnabled = false
	common.RDB = nil
	t.Cleanup(func() {
		common.RedisEnabled = previousRedis
		common.RDB = previousClient
	})
	router := newDesktopV2TestRouter()

	start := httptest.NewRecorder()
	startRequest := httptest.NewRequest(http.MethodPost, "/api/desktop/v2/device-authorizations", strings.NewReader(`{}`))
	startRequest.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(start, startRequest)
	assert.Equal(t, http.StatusServiceUnavailable, start.Code)
	assert.Contains(t, start.Body.String(), "temporarily_unavailable")

	decision := httptest.NewRecorder()
	decisionRequest := httptest.NewRequest(http.MethodPost, "/api/desktop/v2/device-authorizations/decision", strings.NewReader(`{"user_code":"ABCD-EFGH","decision":"approve"}`))
	decisionRequest.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(decision, decisionRequest)
	assert.Equal(t, http.StatusUnauthorized, decision.Code)

	revoke := httptest.NewRecorder()
	router.ServeHTTP(revoke, httptest.NewRequest(http.MethodDelete, "/api/desktop/v2/sessions/current", nil))
	assert.Equal(t, http.StatusUnauthorized, revoke.Code)
}

func TestDesktopV2UnsupportedMethodsDoNotFallThroughToCapabilities(t *testing.T) {
	router := newDesktopV2TestRouter()
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPut, "/api/desktop/v2/bootstrap", nil))

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.NotContains(t, recorder.Body.String(), "desktop-integration-v2")
}
