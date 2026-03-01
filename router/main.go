package router

import (
	"embed"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
	"github.com/go-fuego/fuego"
)

func SetRouter(router *gin.Engine, buildFS embed.FS, indexPage []byte) {
	var engine *fuego.Engine
	if os.Getenv("ENABLE_OPENAPI") == "true" {
		engine = newOpenAPIEngine()
	}

	SetApiRouter(router, engine)
	SetDashboardRouter(router, engine)
	SetRelayRouter(router, engine)
	SetVideoRouter(router, engine)
	registerOpenAPIRoutes(engine, router)

	frontendBaseUrl := os.Getenv("FRONTEND_BASE_URL")
	if common.IsMasterNode && frontendBaseUrl != "" {
		frontendBaseUrl = ""
		common.SysLog("FRONTEND_BASE_URL is ignored on master node")
	}
	if frontendBaseUrl == "" {
		SetWebRouter(router, buildFS, indexPage)
	} else {
		frontendBaseUrl = strings.TrimSuffix(frontendBaseUrl, "/")
		router.NoRoute(func(c *gin.Context) {
			c.Set(middleware.RouteTagKey, "web")
			c.Redirect(http.StatusMovedPermanently, fmt.Sprintf("%s%s", frontendBaseUrl, c.Request.RequestURI))
		})
	}
}
