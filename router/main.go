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
)

func SetRouter(engine *gin.Engine, buildFS embed.FS, indexPage []byte, sessionMiddleware gin.HandlerFunc) {
	SetRelayRouter(engine)

	dataPlaneRouter := engine.Group("")
	dataPlaneRouter.Use(
		middleware.CORS(),
		middleware.DecompressRequestMiddleware(),
		middleware.StatsMiddleware(),
	)
	SetVideoRouter(dataPlaneRouter)

	appRouter := engine.Group("")
	if sessionMiddleware != nil {
		appRouter.Use(sessionMiddleware)
	}
	middleware.SetUpLogger(appRouter)

	SetApiRouter(appRouter)
	SetDashboardRouter(appRouter)

	frontendBaseUrl := os.Getenv("FRONTEND_BASE_URL")
	if common.IsMasterNode && frontendBaseUrl != "" {
		frontendBaseUrl = ""
		common.SysLog("FRONTEND_BASE_URL is ignored on master node")
	}
	if frontendBaseUrl == "" {
		SetWebRouter(engine, appRouter, buildFS, indexPage)
	} else {
		frontendBaseUrl = strings.TrimSuffix(frontendBaseUrl, "/")
		engine.NoRoute(func(c *gin.Context) {
			c.Redirect(http.StatusMovedPermanently, fmt.Sprintf("%s%s", frontendBaseUrl, c.Request.RequestURI))
		})
	}
}
