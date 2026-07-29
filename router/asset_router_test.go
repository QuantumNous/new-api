package router

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSetBytePlusAssetRouterRegistersPublicAssetRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()

	SetBytePlusAssetRouter(engine)

	routes := map[string]bool{}
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = true
	}

	for _, want := range []string{
		http.MethodPost + " /v1/assets",
		http.MethodGet + " /v1/assets/:asset_id",
	} {
		require.True(t, routes[want], "route %s was not registered; routes=%v", want, engine.Routes())
	}
	require.False(t, routes[http.MethodGet+" /v1/assets"], "list endpoint must not be registered")
	require.False(t, routes[http.MethodDelete+" /v1/assets/:asset_id"], "delete endpoint must not be registered")
}

func TestBytePlusAssetRoutesReachTokenAuthWithoutDistribution(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetBytePlusAssetRouter(engine)

	for _, tc := range []struct {
		method string
		path   string
	}{
		{method: http.MethodPost, path: "/v1/assets"},
		{method: http.MethodGet, path: "/v1/assets/ast_1234567890abcdefABCDEF1234567890"},
	} {
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(tc.method, tc.path, nil))
		require.NotEqual(t, http.StatusNotFound, recorder.Code, "%s %s route missing", tc.method, tc.path)
		require.Equal(t, http.StatusUnauthorized, recorder.Code, "%s %s should stop at TokenAuth without credentials, body=%s", tc.method, tc.path, recorder.Body.String())
		require.NotContains(t, recorder.Body.String(), "no_available_key")
	}
}

func TestBytePlusAssetRouterUsesTokenAuthOnlyAndNoDistribute(t *testing.T) {
	source, err := os.ReadFile("asset-router.go")
	require.NoError(t, err)

	text := string(source)
	require.Contains(t, text, `middleware.RouteTag("asset")`)
	require.Contains(t, text, "middleware.TokenAuth()")
	require.NotContains(t, text, "middleware.Distribute()")
	require.NotContains(t, text, ".GET(\"/assets\"")
	require.NotContains(t, text, ".DELETE(")
}

func TestSetRouterIncludesBytePlusAssetRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()

	SetRouter(engine, ThemeAssets{})

	routes := map[string]bool{}
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = true
	}

	require.True(t, routes[http.MethodPost+" /v1/assets"])
	require.True(t, routes[http.MethodGet+" /v1/assets/:asset_id"])
}
