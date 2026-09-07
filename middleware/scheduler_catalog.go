package middleware

import (
	"crypto/subtle"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// SchedulerCatalogAuth protects the credential-free Catalog export with a
// dedicated machine token. It intentionally does not reuse dashboard
// AdminAuth: Scheduler is a service principal, not a human admin session.
func SchedulerCatalogAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		expected := strings.TrimSpace(os.Getenv("SCHEDULER_CATALOG_TOKEN"))
		authorization := strings.TrimSpace(c.GetHeader("Authorization"))
		provided := strings.TrimSpace(strings.TrimPrefix(authorization, "Bearer "))
		if expected == "" || provided == "" || subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "error": "scheduler catalog unauthorized"})
			return
		}
		c.Next()
	}
}
