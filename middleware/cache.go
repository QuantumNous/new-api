package middleware

import (
	"regexp"

	"github.com/gin-gonic/gin"
)

var fingerprintedAssetPattern = regexp.MustCompile(`\.[0-9a-f]{8,}\.(?:css|eot|gif|ico|jpe?g|js|png|svg|ttf|webp|woff2?)$`)

func Cache() func(c *gin.Context) {
	return func(c *gin.Context) {
		if fingerprintedAssetPattern.MatchString(c.Request.URL.Path) {
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			// HTML, SPA routes and stable filenames must revalidate so a release
			// cannot strand clients on an old entry document.
			c.Header("Cache-Control", "no-cache")
		}
		c.Header("Cache-Version", "b688f2fb5be447c25e5aa3bd063087a83db32a288bf6a4f35f2d8db310e40b14")
		c.Next()
	}
}
