package middleware

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	config := cors.DefaultConfig()
	config.AllowAllOrigins = common.GetEnvOrDefaultBool("CORS_ALLOW_ALL_ORIGINS", true)
	if config.AllowAllOrigins {
		// Per W3C CORS spec: AllowCredentials must be false when AllowAllOrigins
		// is true (wildcard Access-Control-Allow-Origin cannot be combined with credentials).
		config.AllowCredentials = false
	} else {
		config.AllowOrigins = parseCORSAllowedOrigins(common.GetEnvOrDefaultString("CORS_ALLOWED_ORIGINS", ""))
		if len(config.AllowOrigins) == 0 {
			config.AllowOriginFunc = func(origin string) bool {
				return false
			}
		}
		config.AllowCredentials = common.GetEnvOrDefaultBool("CORS_ALLOW_CREDENTIALS", true)
	}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"*"}
	return cors.New(config)
}

func parseCORSAllowedOrigins(value string) []string {
	parts := strings.Split(value, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		origin := strings.TrimSpace(part)
		if origin != "" {
			origins = append(origins, origin)
		}
	}
	return origins
}

func PoweredBy() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-New-Api-Version", common.Version)
		c.Next()
	}
}
