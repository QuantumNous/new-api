package router

import (
	"bytes"
	"crypto/sha256"
	"embed"
	"fmt"
	"net/http"
	"path/filepath"
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

const staleChunkRecoveryScript = `(function () {
  var version="__FRONTEND_VERSION__";
  var url=new URL(window.location.href);
  if (url.searchParams.get("_app_build")===version) return;
  url.searchParams.set("_app_build",version);
  window.location.replace(url.href);
})();`

func recoverMissingStaticAsset(frontendFS static.ServeFileSystem, version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		if !strings.HasPrefix(path, "/static/") || frontendFS.Exists("/", path) {
			c.Next()
			return
		}

		c.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
		c.Header("CDN-Cache-Control", "no-store")
		c.Header("Cloudflare-CDN-Cache-Control", "no-store")
		if strings.EqualFold(filepath.Ext(path), ".js") {
			c.Data(http.StatusOK, "application/javascript; charset=utf-8", []byte(strings.ReplaceAll(staleChunkRecoveryScript, "__FRONTEND_VERSION__", version)))
		} else {
			c.Status(http.StatusNotFound)
		}
		c.Abort()
	}
}

func SetWebRouter(router *gin.Engine, assets WebAssets) {
	frontendFS := common.EmbedFolder(assets.BuildFS, "web/dist")
	// Derive the browser version from the shipped entry (including its hashed
	// asset URLs), so a missed backend version flag cannot strand old clients.
	version := fmt.Sprintf("%x", sha256.Sum256(assets.IndexPage))
	meta := []byte(`<meta name="frontend-version" content="` + version + `"></head>`)
	indexPage := bytes.Replace(assets.IndexPage, []byte("</head>"), meta, 1)
	router.GET("/api/frontend-version", middleware.DisableCache(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"version": version}})
	})

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())
	router.Use(recoverMissingStaticAsset(frontendFS, version))
	router.Use(func(c *gin.Context) {
		if c.Request.URL.Path == "/" || c.Request.URL.Path == "/index.html" {
			c.Data(http.StatusOK, "text/html; charset=utf-8", indexPage)
			c.Abort()
			return
		}
		c.Next()
	})
	router.Use(static.Serve("/", frontendFS))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexPage)
	})
}
