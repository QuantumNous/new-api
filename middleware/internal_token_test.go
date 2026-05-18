package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func newTokenRouter() *gin.Engine {
	r := gin.New()
	r.GET("/internal/probe", InternalToken(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	return r
}

func TestInternalToken_MissingEnv(t *testing.T) {
	t.Setenv("DEEPROUTER_INTERNAL_TOKEN", "")
	r := newTokenRouter()
	req := httptest.NewRequest(http.MethodGet, "/internal/probe", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503 when token unset, got %d", w.Code)
	}
}

func TestInternalToken_MissingHeader(t *testing.T) {
	t.Setenv("DEEPROUTER_INTERNAL_TOKEN", "secret")
	r := newTokenRouter()
	req := httptest.NewRequest(http.MethodGet, "/internal/probe", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without header, got %d", w.Code)
	}
}

func TestInternalToken_WrongToken(t *testing.T) {
	t.Setenv("DEEPROUTER_INTERNAL_TOKEN", "secret")
	r := newTokenRouter()
	req := httptest.NewRequest(http.MethodGet, "/internal/probe", nil)
	req.Header.Set("Authorization", "Bearer wrong")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 on wrong token, got %d", w.Code)
	}
}

func TestInternalToken_Pass(t *testing.T) {
	t.Setenv("DEEPROUTER_INTERNAL_TOKEN", "secret")
	r := newTokenRouter()
	req := httptest.NewRequest(http.MethodGet, "/internal/probe", nil)
	req.Header.Set("Authorization", "Bearer secret")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 with valid token, got %d", w.Code)
	}
}

func TestInternalToken_NonBearer(t *testing.T) {
	t.Setenv("DEEPROUTER_INTERNAL_TOKEN", "secret")
	r := newTokenRouter()
	req := httptest.NewRequest(http.MethodGet, "/internal/probe", nil)
	req.Header.Set("Authorization", "Basic xxx")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 on non-bearer, got %d", w.Code)
	}
}

// Sanity check that env reads happen per-request (token rotation safe).
func TestInternalToken_EnvHotChange(t *testing.T) {
	t.Setenv("DEEPROUTER_INTERNAL_TOKEN", "first")
	r := newTokenRouter()

	req1 := httptest.NewRequest(http.MethodGet, "/internal/probe", nil)
	req1.Header.Set("Authorization", "Bearer first")
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Errorf("first token should pass, got %d", w1.Code)
	}

	os.Setenv("DEEPROUTER_INTERNAL_TOKEN", "second")
	req2 := httptest.NewRequest(http.MethodGet, "/internal/probe", nil)
	req2.Header.Set("Authorization", "Bearer first")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code == http.StatusOK {
		t.Errorf("rotated token: old should reject, got %d", w2.Code)
	}
}
