package router

import (
	"bytes"
	"embed"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

func SetWebRouter(router *gin.Engine, buildFS embed.FS, indexPage []byte) {
	router.Use(gzip.Gzip(gzip.DefaultCompression))
	// 静态资源（/assets/）不计入速率限制，只对页面请求限速
	router.Use(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/assets/") {
			c.Next()
			return
		}
		middleware.GlobalWebRateLimit()(c)
	})
	router.Use(middleware.Cache())
	router.Use(static.Serve("/", common.EmbedFolder(buildFS, "web/dist")))

	// Image Studio: 为子应用的目录入口提供 index.html
	imageStudioIndex, err := buildFS.ReadFile("web/dist/image-studio/index.html")
	if err == nil {
		serveImageStudio := func(c *gin.Context) {
			c.Set(middleware.RouteTagKey, "web")
			c.Header("Cache-Control", "no-cache")
			c.Data(http.StatusOK, "text/html; charset=utf-8", imageStudioIndex)
		}
		router.GET("/image-studio", serveImageStudio)
		router.GET("/image-studio/", serveImageStudio)
	}

	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")

		cdnSettings := operation_setting.GetCDNSetting()
		if cdnSettings.Enabled {
			country := c.GetHeader(cdnSettings.DetectHeader)
			if country != "" {
				cdnUrl := operation_setting.GetCDNUrlForCountry(country)
				if cdnUrl != "" {
					modifiedPage := bytes.ReplaceAll(indexPage, []byte("/assets/"), []byte(cdnUrl+"/assets/"))
					c.Data(http.StatusOK, "text/html; charset=utf-8", modifiedPage)
					return
				}
			}
		}

		c.Data(http.StatusOK, "text/html; charset=utf-8", indexPage)
	})
}
