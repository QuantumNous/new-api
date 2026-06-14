package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/internal/policy"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// TestAirbotixPolicy_DBErrorFallsThrough verifies the defensive path in
// middleware/policy.go: when userId > 0 but the DB lookup fails, the
// middleware must NOT block the request — it must set a passthrough decision
// and call Next(). Uses dependency injection (airbotixPolicyWith) to avoid
// a real DB.
func TestAirbotixPolicy_DBErrorFallsThrough(t *testing.T) {
	gin.SetMode(gin.TestMode)
	nextCalled := false

	dbErrLookup := func(_ int, _ bool) (*model.User, error) {
		return nil, errors.New("simulated DB error")
	}

	engine := gin.New()
	engine.GET("/test",
		func(c *gin.Context) { c.Set("id", 99); c.Next() }, // simulate TokenAuth
		airbotixPolicyWith(dbErrLookup),
		func(c *gin.Context) {
			nextCalled = true
			raw, ok := common.GetContextKey(c, constant.ContextKeyPolicyDecision)
			if !ok {
				t.Error("policy decision must be set in context even when DB lookup fails")
				c.Status(http.StatusOK)
				return
			}
			d, castOK := raw.(policy.Decision)
			if !castOK {
				t.Error("policy decision must be of type policy.Decision")
				c.Status(http.StatusOK)
				return
			}
			if d.KidsMode || d.EnforceModelWhitelist || d.EnforceZDR || d.InjectSystemPrompt || d.StripIdentifying {
				t.Errorf("DB error must yield passthrough decision (all constraints off); got %+v", d)
			}
			c.Status(http.StatusOK)
		},
	)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	engine.ServeHTTP(w, req)

	if !nextCalled {
		t.Fatal("handler after middleware must be reached even when DB lookup fails (Next() must be called)")
	}
}

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
