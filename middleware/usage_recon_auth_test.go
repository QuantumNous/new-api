package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
)

func newUsageAuthEngine() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	g := r.Group("/usage")
	g.Use(UsageReconAuth())
	g.GET("/ping", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })
	return r
}

func TestUsageReconAuth(t *testing.T) {
	t.Run("503 when env not set", func(t *testing.T) {
		os.Unsetenv(UsageReconTokenEnv)
		req := httptest.NewRequest(http.MethodGet, "/usage/ping", nil)
		rec := httptest.NewRecorder()
		newUsageAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503; body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("401 when token missing", func(t *testing.T) {
		os.Setenv(UsageReconTokenEnv, "secret")
		defer os.Unsetenv(UsageReconTokenEnv)
		req := httptest.NewRequest(http.MethodGet, "/usage/ping", nil)
		rec := httptest.NewRecorder()
		newUsageAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", rec.Code)
		}
	})

	t.Run("401 when token wrong", func(t *testing.T) {
		os.Setenv(UsageReconTokenEnv, "secret")
		defer os.Unsetenv(UsageReconTokenEnv)
		req := httptest.NewRequest(http.MethodGet, "/usage/ping", nil)
		req.Header.Set("Authorization", "Bearer wrong")
		rec := httptest.NewRecorder()
		newUsageAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", rec.Code)
		}
	})

	t.Run("200 when Bearer token correct", func(t *testing.T) {
		os.Setenv(UsageReconTokenEnv, "secret")
		defer os.Unsetenv(UsageReconTokenEnv)
		req := httptest.NewRequest(http.MethodGet, "/usage/ping", nil)
		req.Header.Set("Authorization", "Bearer secret")
		rec := httptest.NewRecorder()
		newUsageAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
		}
	})
}
