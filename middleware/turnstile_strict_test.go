package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func TestTurnstileCheckStrictDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	common.TurnstileCheckEnabled = false
	r := gin.New()
	r.POST("/x", TurnstileCheckStrict(), func(c *gin.Context) {
		c.JSON(200, gin.H{"success": true})
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/x", nil)
	r.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("code %d", w.Code)
	}
}

func TestTurnstileCheckStrictRequiresToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	common.TurnstileCheckEnabled = true
	common.TurnstileSecretKey = "secret"
	r := gin.New()
	r.POST("/x", TurnstileCheckStrict(), func(c *gin.Context) {
		c.JSON(200, gin.H{"success": true, "ok": true})
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/x", nil)
	r.ServeHTTP(w, req)
	if w.Body.String() == "" || w.Code != 200 {
		t.Fatalf("unexpected: %s", w.Body.String())
	}
	if !contains(w.Body.String(), "Turnstile token 为空") {
		t.Fatalf("want empty token error, got %s", w.Body.String())
	}
}

func TestTurnstileCheckStrictEveryRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	common.TurnstileCheckEnabled = true
	common.TurnstileSecretKey = "secret"
	calls := 0
	turnstileVerifyFunc = func(secret, response, remoteIP string) (bool, error) {
		calls++
		return response == "good", nil
	}
	t.Cleanup(func() {
		turnstileVerifyFunc = defaultTurnstileVerify
		common.TurnstileCheckEnabled = false
	})

	r := gin.New()
	r.POST("/x", TurnstileCheckStrict(), func(c *gin.Context) {
		c.JSON(200, gin.H{"success": true})
	})

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/x?turnstile=good", nil)
		r.ServeHTTP(w, req)
		if !contains(w.Body.String(), `"success":true`) {
			t.Fatalf("request %d failed: %s", i, w.Body.String())
		}
	}
	if calls != 2 {
		t.Fatalf("strict mode should verify every request, calls=%d", calls)
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 ||
		(func() bool {
			for i := 0; i+len(sub) <= len(s); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
			return false
		})())
}
