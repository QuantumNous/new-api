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

func TestUserModelAccessRouteIsRegisteredAndRequiresUserAuth(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("model-access-route-auth"))))
	SetApiRouter(engine)

	registered := false
	for _, route := range engine.Routes() {
		if route.Method == http.MethodGet && route.Path == "/api/user/model-access" {
			registered = true
			break
		}
	}
	require.True(t, registered)

	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/user/model-access", nil))
	require.Equal(t, http.StatusUnauthorized, recorder.Code)
}
