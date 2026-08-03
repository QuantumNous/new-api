package middleware

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

// UsageReconTokenEnv is the env var holding the static shared secret that guards
// the /usage reconciliation endpoints. Empty => endpoints are closed (503).
const UsageReconTokenEnv = "BLOCKRUN_USAGE_SUMMARY_TOKEN"

// UsageReconAuth guards the reconciliation endpoints with a single static
// Bearer token (env). It deliberately does NOT use the JWT / token / user
// system: the token only authenticates the caller, it does not scope a user.
func UsageReconAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		want := strings.TrimSpace(common.GetEnvOrDefaultString(UsageReconTokenEnv, ""))
		if want == "" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "usage reconciliation token not configured"})
			c.Abort()
			return
		}
		got := usageReconBearer(c.GetHeader("Authorization"))
		if got == "" || subtle.ConstantTimeCompare([]byte(got), []byte(want)) != 1 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// usageReconBearer extracts the token from an "Authorization: Bearer <token>"
// header. Only the Bearer scheme is accepted (no ?token= / custom-header fallback).
func usageReconBearer(header string) string {
	parts := strings.Fields(header)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return parts[1]
}
