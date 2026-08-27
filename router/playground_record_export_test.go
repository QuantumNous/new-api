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

func TestPlaygroundRecordExportRouteIsRegisteredForAdministrators(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	routes := map[string]string{}
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = route.Handler
	}
	handler, ok := routes["GET /api/playground/records/export"]
	require.True(t, ok, "missing Playground record export route")
	require.Contains(t, handler, "controller.ExportPlaygroundRecords")
}

func TestPlaygroundRecordExportRouteRejectsOrdinaryUsers(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("playground-export-auth"))))
	engine.GET("/login-ordinary", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("id", 321)
		session.Set("username", "ordinary-user")
		session.Set("role", common.RoleCommonUser)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "default")
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})
	SetApiRouter(engine)

	login := httptest.NewRecorder()
	engine.ServeHTTP(login, httptest.NewRequest(http.MethodGet, "/login-ordinary", nil))
	require.Equal(t, http.StatusNoContent, login.Code)

	request := httptest.NewRequest(http.MethodGet, "/api/playground/records/export", nil)
	request.Header.Set("New-Api-User", "321")
	for _, sessionCookie := range login.Result().Cookies() {
		request.AddCookie(sessionCookie)
	}
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.NotContains(t, recorder.Header().Get("Content-Disposition"), "attachment")
}

func TestPlaygroundRecordExportRouteAllowsAdministratorsToReachHandler(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("playground-export-admin-auth"))))
	engine.GET("/login-admin", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("id", 322)
		session.Set("username", "admin-user")
		session.Set("role", common.RoleAdminUser)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "default")
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})
	SetApiRouter(engine)

	login := httptest.NewRecorder()
	engine.ServeHTTP(login, httptest.NewRequest(http.MethodGet, "/login-admin", nil))
	require.Equal(t, http.StatusNoContent, login.Code)

	request := httptest.NewRequest(http.MethodGet, "/api/playground/records/export?user_id=invalid", nil)
	request.Header.Set("New-Api-User", "322")
	for _, sessionCookie := range login.Result().Cookies() {
		request.AddCookie(sessionCookie)
	}
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
}
