package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetAnalyticsSelfReturnsSessionIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("analytics-session-test"))))
	router.GET("/api/user/analytics-self", GetAnalyticsSelf)
	router.GET("/login", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("id", 123)
		session.Set("username", "tester")
		session.Set("role", common.RoleCommonUser)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "default")
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})

	loginRecorder := httptest.NewRecorder()
	router.ServeHTTP(loginRecorder, httptest.NewRequest(http.MethodGet, "/login", nil))
	require.Equal(t, http.StatusNoContent, loginRecorder.Code)

	request := httptest.NewRequest(http.MethodGet, "/api/user/analytics-self", nil)
	for _, cookie := range loginRecorder.Result().Cookies() {
		request.AddCookie(cookie)
	}
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			ID       int    `json:"id"`
			Username string `json:"username"`
			Role     int    `json:"role"`
			Status   int    `json:"status"`
			Group    string `json:"group"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, 123, payload.Data.ID)
	require.Equal(t, "tester", payload.Data.Username)
	require.Equal(t, common.RoleCommonUser, payload.Data.Role)
	require.Equal(t, common.UserStatusEnabled, payload.Data.Status)
	require.Equal(t, "default", payload.Data.Group)
}

func TestGetAnalyticsSelfRejectsAnonymousRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("analytics-session-test"))))
	router.GET("/api/user/analytics-self", GetAnalyticsSelf)

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/user/analytics-self", nil))

	require.Equal(t, http.StatusUnauthorized, recorder.Code)
	require.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
}
