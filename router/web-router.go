package router

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

func SetWebRouter(router gin.IRouter, buildFS fs.FS) {
	webFS, err := fs.Sub(buildFS, "web/dist")
	if err != nil {
		panic(err)
	}

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())

	router.GET("/assets/*filepath", func(c *gin.Context) {
		filePath := "assets/" + strings.TrimPrefix(c.Param("filepath"), "/")
		serveEmbeddedStaticFile(c, webFS, filePath)
	})

	entries, err := fs.ReadDir(webFS, ".")
	if err != nil {
		panic(err)
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		filePath := entry.Name()
		router.GET("/"+filePath, func(c *gin.Context) {
			serveEmbeddedStaticFile(c, webFS, filePath)
		})
	}
}

func SetWebNoRouteHandler(router *gin.Engine, indexPage []byte) {
	router.NoRoute(func(c *gin.Context) {
		requestPath := c.Request.URL.Path
		if common.AppBasePath != "" && requestPath == common.AppBasePath {
			target := common.AppBasePath + "/"
			if rawQuery := c.Request.URL.RawQuery; rawQuery != "" {
				target += "?" + rawQuery
			}
			c.Redirect(http.StatusMovedPermanently, target)
			return
		}

		strippedPath, ok := common.StripAppBasePath(requestPath)
		if !ok {
			c.Status(http.StatusNotFound)
			return
		}

		c.Set(middleware.RouteTagKey, "web")
		if isAPINotFoundPath(strippedPath) {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexPage)
	})
}

func isAPINotFoundPath(requestPath string) bool {
	apiPrefixes := []string{
		"/api",
		"/assets",
		"/dashboard",
		"/jimeng",
		"/kling",
		"/mj",
		"/pg",
		"/suno",
		"/v1",
		"/v1beta",
	}
	for _, prefix := range apiPrefixes {
		if requestPath == prefix || strings.HasPrefix(requestPath, prefix+"/") {
			return true
		}
	}
	return false
}

func serveEmbeddedStaticFile(c *gin.Context, webFS fs.FS, filePath string) {
	info, err := fs.Stat(webFS, filePath)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	if info.IsDir() {
		c.Status(http.StatusNotFound)
		return
	}

	c.FileFromFS(filePath, http.FS(webFS))
}
