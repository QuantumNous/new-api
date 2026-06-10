package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
)

// TestAirbotixPolicy_ZeroUserIdPassesThrough verifies that when no token auth
// has run (userId == 0 in gin context), the middleware calls Next() without
// setting a policy decision. Unauthenticated paths must not be blocked.
func TestAirbotixPolicy_ZeroUserIdPassesThrough(t *testing.T) {
	gin.SetMode(gin.TestMode)
	nextCalled := false
	engine := gin.New()
	engine.GET("/test", AirbotixPolicy(), func(c *gin.Context) {
		nextCalled = true
		_, hasDecision := common.GetContextKey(c, constant.ContextKeyPolicyDecision)
		if hasDecision {
			t.Errorf("policy decision must not be set when userId=0")
		}
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	engine.ServeHTTP(w, req)

	if !nextCalled {
		t.Fatal("request handler must be reached when userId=0 (middleware must call Next)")
	}
}
