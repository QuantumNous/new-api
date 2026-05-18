package middleware

import (
	"crypto/subtle"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// InternalToken guards endpoints under /internal/* with a shared-secret
// Bearer token sourced from the DEEPROUTER_INTERNAL_TOKEN env var. Used by
// the smart-router sidecar to call /internal/router-catalog.
//
// Constant-time comparison prevents timing leaks. When the env var is
// unset the endpoint reports 503 — accidentally exposing the catalog to
// anonymous callers in mis-configured deploys is worse than 503.
func InternalToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		expected := os.Getenv("DEEPROUTER_INTERNAL_TOKEN")
		if expected == "" {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error": "internal_token_not_configured",
			})
			return
		}
		hdr := c.GetHeader("Authorization")
		const prefix = "Bearer "
		if !strings.HasPrefix(hdr, prefix) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "missing_bearer_token",
			})
			return
		}
		got := strings.TrimPrefix(hdr, prefix)
		if subtle.ConstantTimeCompare([]byte(got), []byte(expected)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid_token",
			})
			return
		}
		c.Next()
	}
}
