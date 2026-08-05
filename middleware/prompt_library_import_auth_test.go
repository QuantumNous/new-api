package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
)

func newPromptLibraryImportAuthEngine() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	g := r.Group("/api/prompt-library")
	g.Use(PromptLibraryImportAuth())
	g.POST("/import", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })
	return r
}

func TestPromptLibraryImportAuth(t *testing.T) {
	t.Run("503 when env not set", func(t *testing.T) {
		os.Unsetenv(PromptLibraryImportTokenEnv)
		req := httptest.NewRequest(http.MethodPost, "/api/prompt-library/import", nil)
		rec := httptest.NewRecorder()
		newPromptLibraryImportAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503; body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("401 when token missing", func(t *testing.T) {
		os.Setenv(PromptLibraryImportTokenEnv, "secret")
		defer os.Unsetenv(PromptLibraryImportTokenEnv)
		req := httptest.NewRequest(http.MethodPost, "/api/prompt-library/import", nil)
		rec := httptest.NewRecorder()
		newPromptLibraryImportAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", rec.Code)
		}
	})

	t.Run("401 when token wrong", func(t *testing.T) {
		os.Setenv(PromptLibraryImportTokenEnv, "secret")
		defer os.Unsetenv(PromptLibraryImportTokenEnv)
		req := httptest.NewRequest(http.MethodPost, "/api/prompt-library/import", nil)
		req.Header.Set("Authorization", "Bearer wrong")
		rec := httptest.NewRecorder()
		newPromptLibraryImportAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", rec.Code)
		}
	})

	t.Run("200 when Bearer token correct", func(t *testing.T) {
		os.Setenv(PromptLibraryImportTokenEnv, "secret")
		defer os.Unsetenv(PromptLibraryImportTokenEnv)
		req := httptest.NewRequest(http.MethodPost, "/api/prompt-library/import", nil)
		req.Header.Set("Authorization", "Bearer secret")
		rec := httptest.NewRecorder()
		newPromptLibraryImportAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
		}
	})
}
