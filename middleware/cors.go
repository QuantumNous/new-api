package middleware

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	config := cors.DefaultConfig()
	config.AllowCredentials = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"*"}
	// AllowAllOrigins + AllowCredentials is invalid per CORS spec.
	// Use AllowOriginFunc to echo back the request origin instead.
	config.AllowOriginFunc = func(origin string) bool {
		// Allow localhost for development
		if strings.HasPrefix(origin, "http://localhost") || strings.HasPrefix(origin, "http://127.0.0.1") {
			return true
		}
		// Allow all HTTPS origins (production)
		if strings.HasPrefix(origin, "https://") {
			return true
		}
		return false
	}
	return cors.New(config)
}

func PoweredBy() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-New-Api-Version", common.Version)
		c.Next()
	}
}
