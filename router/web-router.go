package router

import (
	"embed"
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// WebAssets holds the embedded dashboard frontend assets.
type WebAssets struct {
	BuildFS   embed.FS
	IndexPage []byte
}

func isRelayNoRoutePath(path string) bool {
	path = strings.ToLower(path)
	return strings.HasPrefix(path, "/v1") ||
		strings.HasPrefix(path, "/api") ||
		strings.HasPrefix(path, "/assets")
}

func SetWebRouter(router *gin.Engine, assets WebAssets) {
	frontendFS := common.EmbedFolder(assets.BuildFS, "web/dist")

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())

	// Register OAuth Provider routes as route handlers (before static middleware)
	testRoute := router.Group("/")
	testRoute.GET("/debug-test", func(c *gin.Context) {
		c.String(200, "TEST OK")
	})
	router.GET("/oauth/authorize", middleware.DisableCache(), controller.OAuthProviderAuthorize)
	router.POST("/oauth/authorize", middleware.DisableCache(), controller.OAuthProviderAuthorizePost)
	router.POST("/oauth/token", middleware.DisableCache(), controller.OAuthProviderToken)
	router.GET("/oauth/userinfo", middleware.DisableCache(), controller.OAuthProviderUserInfo)
	router.GET("/.well-known/openid-configuration", controller.OAuthProviderWellKnown)

	// Debug: log and skip static for known API paths
	router.Use(func(c *gin.Context) {
		common.SysLog(fmt.Sprintf("DEBUG MIDDLEWARE: path=%s method=%s", c.Request.URL.Path, c.Request.Method))
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/api/") ||
			strings.HasPrefix(path, "/oauth/") ||
			strings.HasPrefix(path, "/v1/") ||
			strings.HasPrefix(path, "/.well-known") ||
			strings.HasPrefix(path, "/assets/") ||
			path == "/api" ||
			path == "/oauth" ||
			path == "/v1" {
			common.SysLog(fmt.Sprintf("Skipping static for API path: %s", path))
			c.Next()
			return
		}
		common.SysLog(fmt.Sprintf("Static middleware handling: %s", path))
		static.Serve("/", frontendFS)(c)
	})

	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if isRelayNoRoutePath(c.Request.URL.Path) {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", assets.IndexPage)
	})
}
