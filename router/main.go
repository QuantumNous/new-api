package router

import (
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func SetRouter(router *gin.Engine, buildFS fs.FS, indexPage []byte) {
	var routeRoot gin.IRouter = router
	if common.AppBasePath != "" {
		baseGroup := router.Group(common.AppBasePath)
		baseGroup.Use(middleware.StripAppBasePath())
		routeRoot = baseGroup
	}

	SetApiRouter(routeRoot)
	SetDashboardRouter(routeRoot)
	SetRelayRouter(routeRoot)
	SetVideoRouter(routeRoot)
	frontendBaseUrl := os.Getenv("FRONTEND_BASE_URL")
	if common.IsMasterNode && frontendBaseUrl != "" {
		frontendBaseUrl = ""
		common.SysLog("FRONTEND_BASE_URL is ignored on master node")
	}
	if frontendBaseUrl == "" {
		SetWebRouter(routeRoot, buildFS)
		SetWebNoRouteHandler(router, indexPage)
	} else {
		frontendBaseUrl = strings.TrimSuffix(frontendBaseUrl, "/")
		router.NoRoute(func(c *gin.Context) {
			if _, ok := common.StripAppBasePath(c.Request.URL.Path); !ok {
				c.Status(http.StatusNotFound)
				return
			}
			c.Set(middleware.RouteTagKey, "web")
			c.Redirect(http.StatusMovedPermanently, fmt.Sprintf("%s%s", frontendBaseUrl, c.Request.RequestURI))
		})
	}
}
