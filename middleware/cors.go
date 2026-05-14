package middleware

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	config := cors.DefaultConfig()
	config.AllowAllOrigins = common.GetEnvOrDefaultBool("CORS_ALLOW_ALL_ORIGINS", true)
	if config.AllowAllOrigins {
		// AllowCredentials cannot be true with AllowAllOrigins in strict browsers;
		// when AllowAllOrigins is enabled, credentials support is controlled separately.
		config.AllowCredentials = common.GetEnvOrDefaultBool("CORS_ALLOW_CREDENTIALS", true)
	}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"*"}
	return cors.New(config)
}

func PoweredBy() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-New-Api-Version", common.Version)
		c.Next()
	}
}
