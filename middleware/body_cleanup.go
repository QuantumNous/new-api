package middleware

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// BodyStorageCleanup requests body storage cleanup middleware
// Automatically clean disk/memory cache after request processing is complete
func BodyStorageCleanup() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			// Clean up storage after request ends
			common.CleanupBodyStorage(c)

			// Clean file cache (URL downloaded files, etc.)
			service.CleanupFileSources(c)
		}()
		c.Next()
	}
}
