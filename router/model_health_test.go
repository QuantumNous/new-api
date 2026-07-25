package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestModelHealthAdminRoutesAreRegistered(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	want := map[string]string{
		"/api/data/model_health":        http.MethodGet,
		"/api/data/model_health/detail": http.MethodGet,
	}
	got := map[string]string{}
	for _, route := range engine.Routes() {
		if _, ok := want[route.Path]; ok {
			got[route.Path] = route.Method
		}
	}

	require.Equal(t, want, got)
}

func TestModelHealthAdminRoutesRejectUnauthenticatedRequests(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("model-health-auth"))))
	SetApiRouter(engine)

	for _, target := range []string{
		"/api/data/model_health?hours=24",
		"/api/data/model_health/detail?model=gpt-4o&hours=24",
	} {
		t.Run(target, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, target, nil)
			engine.ServeHTTP(recorder, request)

			require.Equal(t, http.StatusUnauthorized, recorder.Code)
		})
	}
}

func TestModelHealthAdminRoutesRejectOrdinaryUsers(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("model-health-user-auth"))))
	engine.GET("/model-health-test-login", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("id", 123)
		session.Set("username", "ordinary-user")
		session.Set("role", common.RoleCommonUser)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "default")
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})
	SetApiRouter(engine)

	loginRecorder := httptest.NewRecorder()
	engine.ServeHTTP(loginRecorder, httptest.NewRequest(http.MethodGet, "/model-health-test-login", nil))
	require.Equal(t, http.StatusNoContent, loginRecorder.Code)

	for _, target := range []string{
		"/api/data/model_health?hours=24",
		"/api/data/model_health/detail?model=gpt-4o&hours=24",
	} {
		t.Run(target, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, target, nil)
			request.Header.Set("New-Api-User", "123")
			for _, sessionCookie := range loginRecorder.Result().Cookies() {
				request.AddCookie(sessionCookie)
			}
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, request)

			require.Equal(t, http.StatusOK, recorder.Code)
			require.Contains(t, recorder.Body.String(), `"success":false`)
		})
	}
}
