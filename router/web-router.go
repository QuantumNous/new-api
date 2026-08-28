package router

import (
	"embed"
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

	// Register OAuth Provider routes FIRST as route handlers (before static middleware)
	router.GET("/oauth/authorize", middleware.DisableCache(), controller.OAuthProviderAuthorize)
	router.POST("/oauth/authorize", middleware.DisableCache(), controller.OAuthProviderAuthorizePost)
	router.POST("/oauth/token", middleware.DisableCache(), controller.OAuthProviderToken)
	router.GET("/oauth/userinfo", middleware.DisableCache(), controller.OAuthProviderUserInfo)
	router.GET("/.well-known/openid-configuration", controller.OAuthProviderWellKnown)

	// Static file serving - use conditional to skip API routes
	router.Use(func(c *gin.Context) {
		path := c.Request.URL.Path
		// Skip static serving for API paths and known API-related paths
		if strings.HasPrefix(path, "/api/") ||
			strings.HasPrefix(path, "/oauth/") ||
			strings.HasPrefix(path, "/v1/") ||
			strings.HasPrefix(path, "/.well-known") ||
			strings.HasPrefix(path, "/assets/") ||
			path == "/api" ||
			path == "/oauth" ||
			path == "/v1" {
			c.Next()
			return
		}
		// Let static middleware handle the rest
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
