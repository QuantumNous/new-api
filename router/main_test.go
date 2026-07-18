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

// TestIsNonSPARequestPath 验证运维与 Relay 前缀不会被当成前端路由。
func TestIsNonSPARequestPath(t *testing.T) {
	for _, path := range []string{
		"/metrics",
		"/metrics?foo=1",
		"/v1/models",
		"/v1beta/models",
		"/api/status",
		"/pg/chat/completions",
		"/mj/submit",
		"/suno/submit",
		"/kling/v1/videos/text2video",
		"/jimeng/",
		"/dashboard/billing/usage",
		"/frontend-healthz",
		"/readyz",
		"/fast/mj/task",
	} {
		require.Truef(t, isNonSPARequestPath(path), "expected non-SPA: %s", path)
	}
	for _, path := range []string{
		"/",
		"/console",
		"/pricing",
		"/about",
		"/sign-in",
		"/static/js/index.js",
		"/dashboard",
		"/dashboard/overview",
		"/dashboard/detail",
	} {
		require.Falsef(t, isNonSPARequestPath(path), "expected SPA-capable: %s", path)
	}
}

// TestEmbeddedFrontendDoesNotServeSPAForMetrics 验证嵌入模式下 /metrics 未启用时不是 HTML 200。
func TestEmbeddedFrontendDoesNotServeSPAForMetrics(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("FRONTEND_MODE", "embedded")
	t.Setenv("METRICS_ENABLED", "")
	t.Setenv("METRICS_TOKEN", "")

	assets := ThemeAssets{
		DefaultIndexPage: []byte("<html>default</html>"),
		ClassicIndexPage: []byte("<html>classic</html>"),
	}
	engine := gin.New()
	require.NoError(t, SetRouterForPlane(engine, assets, PlaneManagement))

	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	require.Equal(t, http.StatusNotFound, recorder.Code)
	require.NotContains(t, recorder.Header().Get("Content-Type"), "text/html")
	require.NotContains(t, recorder.Body.String(), "<html>default</html>")

	// 真正的前端路由仍应回退 index。
	home := httptest.NewRecorder()
	engine.ServeHTTP(home, httptest.NewRequest(http.MethodGet, "/console", nil))
	require.Equal(t, http.StatusOK, home.Code)
	require.Contains(t, home.Body.String(), "<html>default</html>")
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
