package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := strings.TrimRight(strings.TrimSpace(c.GetHeader("Origin")), "/")
		if origin != "" {
			if isAllowedCORSOrigin(origin) {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Access-Control-Allow-Credentials", "true")
				c.Header("Vary", "Origin")
			} else {
				// Public API clients may send a browser Origin. Allow the
				// request without credentials so we never pair "*" with
				// Allow-Credentials: true.
				c.Header("Access-Control-Allow-Origin", "*")
			}
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		if reqHeaders := c.GetHeader("Access-Control-Request-Headers"); reqHeaders != "" {
			c.Header("Access-Control-Allow-Headers", reqHeaders)
		} else {
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, New-Api-User, Cache-Control, Accept, Origin, X-Requested-With")
		}
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func isAllowedCORSOrigin(origin string) bool {
	for _, allowed := range allowedCORSOrigins() {
		if strings.EqualFold(origin, allowed) {
			return true
		}
	}
	return false
}

func allowedCORSOrigins() []string {
	var origins []string
	if v := strings.TrimRight(strings.TrimSpace(os.Getenv("FRONTEND_BASE_URL")), "/"); v != "" {
		origins = append(origins, v)
	}
	if v := strings.TrimRight(strings.TrimSpace(system_setting.ServerAddress), "/"); v != "" {
		origins = append(origins, v)
	}
	return origins
}

func Version() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-New-Api-Version", common.Version)
		c.Next()
	}
}
