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

func TestRecallEmailPreviewRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	found := false
	for _, route := range engine.Routes() {
		if route.Path == "/api/recall-campaigns/email-preview" && route.Method == http.MethodPost {
			found = true
			break
		}
	}
	require.True(t, found)
}

func TestRecallEmailPreviewRouteRequiresAdminAuth(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("recall-email-preview-auth"))))
	SetApiRouter(engine)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/recall-campaigns/email-preview", nil)
	engine.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusUnauthorized, recorder.Code)
}

func TestRecallAudienceUsersRouteIsRegisteredBeforeIDRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	audienceIndex := -1
	idIndex := -1
	for index, route := range engine.Routes() {
		if route.Method != http.MethodGet {
			continue
		}
		switch route.Path {
		case "/api/recall-campaigns/audience-users":
			audienceIndex = index
		case "/api/recall-campaigns/:id":
			idIndex = index
		}
	}

	require.NotEqual(t, -1, audienceIndex)
	require.NotEqual(t, -1, idIndex)
	require.Less(t, audienceIndex, idIndex)
}

func TestRecallAudienceUsersRouteRequiresAdminAuthForNormalUser(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("recall-audience-users-auth"))))
	SetApiRouter(engine)
	engine.GET("/login-common", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("id", 88)
		session.Set("username", "common-user")
		session.Set("role", common.RoleCommonUser)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "plg")
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})

	loginRecorder := httptest.NewRecorder()
	engine.ServeHTTP(loginRecorder, httptest.NewRequest(http.MethodGet, "/login-common", nil))
	require.Equal(t, http.StatusNoContent, loginRecorder.Code)

	request := httptest.NewRequest(http.MethodGet, "/api/recall-campaigns/audience-users?keyword=ada", nil)
	request.Header.Set("New-Api-User", "88")
	for _, cookie := range loginRecorder.Result().Cookies() {
		request.AddCookie(cookie)
	}
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
}
