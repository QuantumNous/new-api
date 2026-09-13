package router

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPrefixedEngineRoutesUnderPrefix(t *testing.T) {
	common.ResetRoutePrefixForTest()
	require.NoError(t, os.Setenv("NEW_API_ROUTE_PREFIX", "/proxy"))
	defer func() {
		_ = os.Unsetenv("NEW_API_ROUTE_PREFIX")
		common.ResetRoutePrefixForTest()
	}()
	common.ResolveRoutePrefix()

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	target := PrefixedEngine(engine)
	assert.Equal(t, "/proxy", common.RoutePrefix())

	target.GET("/api/status", func(c *gin.Context) {
		c.String(http.StatusOK, "status-ok")
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/proxy/api/status", nil)
	engine.ServeHTTP(recorder, request)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "status-ok", recorder.Body.String())

	recorder = httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodGet, "/api/status", nil)
	engine.ServeHTTP(recorder, request)
	assert.Equal(t, http.StatusNotFound, recorder.Code)
}

func TestPrefixedEngineWithoutPrefixKeepsOriginalPaths(t *testing.T) {
	common.ResetRoutePrefixForTest()
	_ = os.Unsetenv("NEW_API_ROUTE_PREFIX")
	common.ResolveRoutePrefix()

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	target := PrefixedEngine(engine)
	assert.Equal(t, "", common.RoutePrefix())

	target.GET("/api/status", func(c *gin.Context) {
		c.String(http.StatusOK, "status-ok")
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	engine.ServeHTTP(recorder, request)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "status-ok", recorder.Body.String())
}

func TestStaticServePathRespectsPrefix(t *testing.T) {
	common.ResetRoutePrefixForTest()
	_ = os.Unsetenv("NEW_API_ROUTE_PREFIX")
	common.ResolveRoutePrefix()
	assert.Equal(t, "/", common.StaticServePath())

	common.ResetRoutePrefixForTest()
	require.NoError(t, os.Setenv("NEW_API_ROUTE_PREFIX", "/proxy"))
	defer func() {
		_ = os.Unsetenv("NEW_API_ROUTE_PREFIX")
		common.ResetRoutePrefixForTest()
	}()
	common.ResolveRoutePrefix()
	assert.Equal(t, "/proxy/", common.StaticServePath())
}
