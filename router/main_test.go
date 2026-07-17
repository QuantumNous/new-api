package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestParsePlane(t *testing.T) {
	for input, expected := range map[string]Plane{
		"":           PlaneAll,
		"all":        PlaneAll,
		"RELAY":      PlaneRelay,
		"management": PlaneManagement,
	} {
		actual, err := ParsePlane(input)
		require.NoError(t, err)
		require.Equal(t, expected, actual)
	}
	_, err := ParsePlane("public")
	require.Error(t, err)
}

func TestSetRouterForPlaneIsolatesRelayAndManagementRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	hasRoute := func(engine *gin.Engine, method, path string) bool {
		for _, route := range engine.Routes() {
			if route.Method == method && route.Path == path {
				return true
			}
		}
		return false
	}

	relayEngine := gin.New()
	require.NoError(t, SetRouterForPlane(relayEngine, ThemeAssets{}, PlaneRelay))
	require.True(t, hasRoute(relayEngine, "GET", "/healthz"))
	require.True(t, hasRoute(relayEngine, "GET", "/livez"))
	require.True(t, hasRoute(relayEngine, "GET", "/readyz"))
	require.True(t, hasRoute(relayEngine, "POST", "/v1/chat/completions"))
	require.False(t, hasRoute(relayEngine, "GET", "/api/status"))

	previousMaster := common.IsMasterNode
	common.IsMasterNode = false
	t.Cleanup(func() { common.IsMasterNode = previousMaster })
	t.Setenv("FRONTEND_BASE_URL", "https://console.example")
	managementEngine := gin.New()
	require.NoError(t, SetRouterForPlane(managementEngine, ThemeAssets{}, PlaneManagement))
	require.True(t, hasRoute(managementEngine, "GET", "/healthz"))
	require.True(t, hasRoute(managementEngine, "GET", "/livez"))
	require.True(t, hasRoute(managementEngine, "GET", "/readyz"))
	require.True(t, hasRoute(managementEngine, "GET", "/api/status"))
	require.False(t, hasRoute(managementEngine, "POST", "/v1/chat/completions"))
}

func TestManagementAPIRoutesApplyCORSAllowlist(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://console.example")
	t.Setenv("SESSION_COOKIE_TRUSTED_URL", "")
	t.Setenv("FRONTEND_BASE_URL", "https://console.example")
	previousMaster := common.IsMasterNode
	common.IsMasterNode = false
	t.Cleanup(func() { common.IsMasterNode = previousMaster })

	engine := gin.New()
	require.NoError(t, SetRouterForPlane(engine, ThemeAssets{}, PlaneManagement))

	preflight := func(origin string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodOptions, "/api/status", nil)
		request.Header.Set("Origin", origin)
		request.Header.Set("Access-Control-Request-Method", http.MethodGet)
		engine.ServeHTTP(recorder, request)
		return recorder
	}

	trusted := preflight("https://console.example")
	require.Equal(t, http.StatusNoContent, trusted.Code)
	require.Equal(t, "https://console.example", trusted.Header().Get("Access-Control-Allow-Origin"))
	require.Equal(t, "true", trusted.Header().Get("Access-Control-Allow-Credentials"))

	untrusted := preflight("https://evil.example")
	require.Equal(t, http.StatusForbidden, untrusted.Code)
	require.Empty(t, untrusted.Header().Get("Access-Control-Allow-Origin"))
}
