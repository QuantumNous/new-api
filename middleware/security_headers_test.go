package middleware

import (
	"crypto/tls"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSecurityHeadersSetsHSTSOnlyForHTTPS(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("plain http no hsts", func(t *testing.T) {
		engine := gin.New()
		engine.Use(SecurityHeaders())
		engine.GET("/x", func(c *gin.Context) { c.String(http.StatusOK, "ok") })
		rec := httptest.NewRecorder()
		engine.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
		require.Equal(t, http.StatusOK, rec.Code)
		require.Empty(t, rec.Header().Get("Strict-Transport-Security"))
		require.Equal(t, "nosniff", rec.Header().Get("X-Content-Type-Options"))
	})

	t.Run("x-forwarded-proto https sets hsts", func(t *testing.T) {
		engine := gin.New()
		engine.Use(SecurityHeaders())
		engine.GET("/x", func(c *gin.Context) { c.String(http.StatusOK, "ok") })
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.Header.Set("X-Forwarded-Proto", "https")
		engine.ServeHTTP(rec, req)
		require.Equal(t, "max-age=15768000", rec.Header().Get("Strict-Transport-Security"))
	})

	t.Run("direct tls sets hsts", func(t *testing.T) {
		engine := gin.New()
		engine.Use(SecurityHeaders())
		engine.GET("/x", func(c *gin.Context) { c.String(http.StatusOK, "ok") })
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.TLS = &tls.ConnectionState{}
		engine.ServeHTTP(rec, req)
		require.Equal(t, "max-age=15768000", rec.Header().Get("Strict-Transport-Security"))
	})
}
