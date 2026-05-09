package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInvitationRebateRecordsRequiresAdminAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(sessions.Sessions("test-session", cookie.NewStore([]byte("test-session-key"))))

	handlerCalled := false
	router.GET(
		"/api/user/invitation_rebate",
		func(c *gin.Context) {
			session := sessions.Default(c)
			session.Set("username", "ordinary-user")
			session.Set("role", common.RoleCommonUser)
			session.Set("id", 1001)
			session.Set("status", common.UserStatusEnabled)
			c.Request.Header.Set("New-Api-User", "1001")
			c.Next()
		},
		middleware.AdminAuth(),
		func(c *gin.Context) {
			handlerCalled = true
			c.Status(http.StatusOK)
		},
	)

	request := httptest.NewRequest(http.MethodGet, "/api/user/invitation_rebate", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	require.False(t, handlerCalled)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"success":false`)
}
