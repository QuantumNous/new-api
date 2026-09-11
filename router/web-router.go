package router

import (
	"embed"
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

const staleChunkRecoveryScript = `const key="newapi:stale-chunk-url";
try {
  const chunk=import.meta.url;
  if (window.sessionStorage.getItem(key)!==chunk) {
    window.sessionStorage.setItem(key,chunk);
    window.location.reload();
  } else {
    window.sessionStorage.removeItem(key);
  }
} catch (_) {
  window.location.reload();
}
export {};`

func recoverMissingStaticAsset(frontendFS static.ServeFileSystem) gin.HandlerFunc {
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
			c.Data(http.StatusOK, "application/javascript; charset=utf-8", []byte(staleChunkRecoveryScript))
		} else {
			c.Status(http.StatusNotFound)
		}
		c.Abort()
	}
}

func SetWebRouter(router *gin.Engine, assets WebAssets) {
	frontendFS := common.EmbedFolder(assets.BuildFS, "web/dist")

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())
	router.Use(recoverMissingStaticAsset(frontendFS))
	router.Use(static.Serve("/", frontendFS))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", assets.IndexPage)
	})
}
