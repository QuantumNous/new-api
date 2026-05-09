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

func TestInvitationRebateRoutesRequireAdminAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)

	for _, path := range []string{"/api/user/invitation_rebate", "/api/user/invitation_rebate/1"} {
		t.Run(path, func(t *testing.T) {
			router := gin.New()
			router.Use(sessions.Sessions("test-session", cookie.NewStore([]byte("test-session-key"))))

			handlerCalled := false
			router.GET(
				path,
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

			request := httptest.NewRequest(http.MethodGet, path, nil)
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)

			require.False(t, handlerCalled)
			assert.Equal(t, http.StatusOK, recorder.Code)
			assert.Contains(t, recorder.Body.String(), `"success":false`)
		})
	}
}
