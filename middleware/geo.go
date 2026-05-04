package middleware

import "github.com/gin-gonic/gin"

func GeoIPHeader() gin.HandlerFunc {
	return func(c *gin.Context) {
		country := c.GetHeader("X-GeoIP-Country")
		if country == "" {
			country = "Nil"
		}
		c.Header("X-GeoIP-Country", country)
		c.Next()
	}
}
