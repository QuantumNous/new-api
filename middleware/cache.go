package middleware

import (
	"github.com/gin-gonic/gin"
	"regexp"
)

var hashedWebAsset = regexp.MustCompile(`^/static/.+\.[a-f0-9]{8,}\.[a-z0-9.]+$`)

func Cache() func(c *gin.Context) {
	return func(c *gin.Context) {
		if hashedWebAsset.MatchString(c.Request.URL.Path) {
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			c.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
			c.Header("CDN-Cache-Control", "no-store")
			c.Header("Cloudflare-CDN-Cache-Control", "no-store")
			c.Header("Pragma", "no-cache")
			c.Header("Expires", "0")
		}
		c.Next()
	}
}
