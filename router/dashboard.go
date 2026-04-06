package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

func SetDashboardRouter(router *gin.Engine) {
	apiRouter := router.Group("/")
	apiRouter.Use(middleware.RouteTag("old_api"))
	apiRouter.Use(gzip.Gzip(gzip.DefaultCompression))
	apiRouter.Use(middleware.GlobalAPIRateLimit())
	apiRouter.Use(middleware.CORS())
	apiRouter.Use(middleware.TokenAuth())
	{
		apiRouter.GET("/dashboard/billing/subscription", controller.GetSubscription)
		apiRouter.GET("/v1/dashboard/billing/subscription", controller.GetSubscription)
		apiRouter.GET("/dashboard/billing/usage", controller.GetUsage)
		apiRouter.GET("/v1/dashboard/billing/usage", controller.GetUsage)
	}

	monitorRouter := router.Group("/")
	monitorRouter.Use(middleware.RouteTag("old_api"))
	monitorRouter.Use(gzip.Gzip(gzip.DefaultCompression))
	monitorRouter.Use(middleware.GlobalAPIRateLimit())
	monitorRouter.Use(middleware.CORS())
	monitorRouter.Use(middleware.UserAuth())
	{
		monitorRouter.GET("/dashboard/channel/stats", controller.GetDashboardChannelStats)
		monitorRouter.GET("/dashboard/model/stats", controller.GetDashboardModelStats)
		monitorRouter.GET("/dashboard/overview", controller.GetDashboardOverview)
		monitorRouter.GET("/dashboard/logs/prompts", controller.GetDashboardPromptLogs)
	}
}
