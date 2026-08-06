package router

import (
	"bytes"
	"io/fs"
	"net/http"
	"os"
	pathpkg "path"
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
	BuildFS       fs.FS
	IndexPage     []byte
	NextBuildFS   fs.FS
	NextIndexPage []byte
}

const nextPlaceholderMarker = `name="ren2hub-next-build" content="placeholder"`

func nextFrontendEnabled() bool {
	return !strings.EqualFold(strings.TrimSpace(os.Getenv("NEXT_FRONTEND_ENABLED")), "false")
}

func nextBuildReady(indexPage []byte) bool {
	return len(indexPage) > 0 && !bytes.Contains(indexPage, []byte(nextPlaceholderMarker))
}

func isNextStaticRequest(requestPath string) bool {
	if strings.HasPrefix(requestPath, "/next/assets/") {
		return true
	}
	relative := strings.TrimPrefix(requestPath, "/next/")
	return relative != requestPath && pathpkg.Ext(relative) != ""
}

func SetWebRouter(router *gin.Engine, assets WebAssets) {
	frontendFS := common.EmbedFolder(assets.BuildFS, "web/dist")
	nextEnabled := nextFrontendEnabled()
	nextReady := nextBuildReady(assets.NextIndexPage)

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())
	router.Use(func(c *gin.Context) {
		if nextEnabled && strings.HasPrefix(c.Request.URL.Path, "/next/assets/") {
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		}
		c.Next()
	})
	router.Use(static.Serve("/", frontendFS))
	if nextEnabled {
		nextFS := common.EmbedFolder(assets.NextBuildFS, "frontend/embed-dist")
		router.Use(static.Serve("/next", nextFS))
	}
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/v1") || strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/mj") || strings.HasPrefix(path, "/pg") || strings.HasPrefix(path, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		if path == "/next" || strings.HasPrefix(path, "/next/") {
			if !nextEnabled {
				controller.RelayNotFound(c)
				return
			}
			if isNextStaticRequest(path) {
				controller.RelayNotFound(c)
				return
			}
			c.Header("Cache-Control", "no-cache")
			if !nextReady {
				c.String(http.StatusServiceUnavailable, "next frontend build is unavailable")
				return
			}
			c.Data(http.StatusOK, "text/html; charset=utf-8", assets.NextIndexPage)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", assets.IndexPage)
	})
}
