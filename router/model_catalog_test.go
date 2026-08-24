package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestModelCatalogReadinessRouteIsAdminOnly(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("catalog-readiness-route-auth"))))
	SetApiRouter(engine)

	registered := false
	for _, route := range engine.Routes() {
		if route.Method == http.MethodGet && route.Path == "/api/models/catalog-readiness" {
			registered = true
			break
		}
	}
	require.True(t, registered)

	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/models/catalog-readiness?group=plg", nil))
	require.Equal(t, http.StatusUnauthorized, recorder.Code)
}

func TestWebsiteFeaturedModelRoutesAreAdminOnly(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("website-featured-route-auth"))))
	SetApiRouter(engine)

	registered := map[string]bool{}
	for _, route := range engine.Routes() {
		if route.Path != "/api/models/website-featured" {
			continue
		}
		registered[route.Method] = true
	}
	require.True(t, registered[http.MethodGet])
	require.True(t, registered[http.MethodPut])

	for _, method := range []string{http.MethodGet, http.MethodPut} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(method, "/api/models/website-featured", nil)
		engine.ServeHTTP(recorder, request)
		require.Equal(t, http.StatusUnauthorized, recorder.Code, method)
	}
}
