package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

func Cache() func(c *gin.Context) {
	return func(c *gin.Context) {
		uri := c.Request.RequestURI
		if strings.HasPrefix(uri, "/assets/") {
			// 构建产物文件名带 hash，允许长缓存。
			c.Header("Cache-Control", "public, max-age=604800, immutable")
		} else {
			// 页面路由（如 /console/skill-market）和其他入口统一禁用缓存，
			// 避免 IAB 持续命中旧前端代码导致“编辑空白”。
			c.Header("Cache-Control", "no-store, no-cache, must-revalidate")
		}
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		c.Header("Cache-Version", "skill-market-hotfix-20260419")
		c.Next()
	}
}
