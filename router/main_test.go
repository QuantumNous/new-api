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

// TestParseFrontendMode 验证前端交付模式的兼容默认值与非法值拒绝逻辑。
func TestParseFrontendMode(t *testing.T) {
	for input, expected := range map[string]frontendMode{
		"":         frontendModeAuto,
		"AUTO":     frontendModeAuto,
		"embedded": frontendModeEmbedded,
		"redirect": frontendModeRedirect,
		"disabled": frontendModeDisabled,
	} {
		actual, err := parseFrontendMode(input)
		require.NoError(t, err)
		require.Equal(t, expected, actual)
	}
	_, err := parseFrontendMode("static")
	require.Error(t, err)
}

// TestFrontendModeRequiresAssetsOrExplicitExternalDelivery 验证纯后端构建不会误入嵌入资源路径。
func TestFrontendModeRequiresAssetsOrExplicitExternalDelivery(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Setenv("FRONTEND_MODE", "embedded")
	err := SetRouterForPlane(gin.New(), ThemeAssets{}, PlaneManagement)
	require.ErrorContains(t, err, "embedded frontend assets are unavailable")

	t.Setenv("FRONTEND_MODE", "disabled")
	require.NoError(t, SetRouterForPlane(gin.New(), ThemeAssets{}, PlaneManagement))
}

// TestFrontendDisabledReturnsNotFoundForUnknownPage 验证纯后端模式对未知页面返回 404 且 API 仍可用。
func TestFrontendDisabledReturnsNotFoundForUnknownPage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("FRONTEND_MODE", "disabled")
	t.Setenv("FRONTEND_BASE_URL", "")

	engine := gin.New()
	require.NoError(t, SetRouterForPlane(engine, ThemeAssets{}, PlaneManagement))

	unknown := httptest.NewRecorder()
	engine.ServeHTTP(unknown, httptest.NewRequest(http.MethodGet, "/console/settings", nil))
	require.Equal(t, http.StatusNotFound, unknown.Code)

	status := httptest.NewRecorder()
	engine.ServeHTTP(status, httptest.NewRequest(http.MethodGet, "/api/status", nil))
	require.NotEqual(t, http.StatusNotFound, status.Code)
}



// TestFrontendModeAutoIgnoresBaseURLOnMaster 验证 auto 模式下 master 忽略 FRONTEND_BASE_URL，且无资源时失败。
func TestFrontendModeAutoIgnoresBaseURLOnMaster(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousMaster := common.IsMasterNode
	common.IsMasterNode = true
	t.Cleanup(func() { common.IsMasterNode = previousMaster })

	t.Setenv("FRONTEND_MODE", "auto")
	t.Setenv("FRONTEND_BASE_URL", "https://console.example")
	err := SetRouterForPlane(gin.New(), ThemeAssets{}, PlaneManagement)
	require.ErrorContains(t, err, "embedded frontend assets are unavailable")
}

// TestExplicitFrontendRedirectWorksOnMaster 验证明示 redirect 可覆盖旧版 master 自动嵌入行为。
func TestExplicitFrontendRedirectWorksOnMaster(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousMaster := common.IsMasterNode
	common.IsMasterNode = true
	t.Cleanup(func() { common.IsMasterNode = previousMaster })
	t.Setenv("FRONTEND_MODE", "redirect")
	t.Setenv("FRONTEND_BASE_URL", "https://console.example/")

	engine := gin.New()
	require.NoError(t, SetRouterForPlane(engine, ThemeAssets{}, PlaneManagement))
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/settings?tab=security", nil)
	engine.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusMovedPermanently, recorder.Code)
	require.Equal(t, "https://console.example/settings?tab=security", recorder.Header().Get("Location"))
}

// TestFrontendRedirectRejectsNonOriginURL 验证跳转配置不能携带路径或非 HTTP(S) 协议。
func TestFrontendRedirectRejectsNonOriginURL(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("FRONTEND_MODE", "redirect")

	t.Setenv("FRONTEND_BASE_URL", "https://console.example/admin")
	require.Error(t, SetRouterForPlane(gin.New(), ThemeAssets{}, PlaneManagement))

	t.Setenv("FRONTEND_BASE_URL", "javascript:alert(1)")
	require.Error(t, SetRouterForPlane(gin.New(), ThemeAssets{}, PlaneManagement))
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

