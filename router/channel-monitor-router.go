package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func registerChannelMonitorRoutes(apiRouter *gin.RouterGroup) {
	adminRoute := apiRouter.Group("/monitor/channel")
	adminRoute.Use(middleware.AdminAuth())
	{
		adminRoute.GET("/", controller.GetAllChannelMonitors)
		adminRoute.POST("/", controller.CreateChannelMonitor)
		adminRoute.GET("/:id", controller.GetChannelMonitor)
		adminRoute.PUT("/:id", controller.UpdateChannelMonitor)
		adminRoute.DELETE("/:id", controller.DeleteChannelMonitor)
		adminRoute.POST("/:id/run", controller.RunChannelMonitor)
		adminRoute.GET("/:id/history", controller.GetChannelMonitorHistory)
	}

	userRoute := apiRouter.Group("/group-status")
	userRoute.Use(middleware.UserAuth())
	{
		userRoute.GET("/", controller.GetGroupStatus)
		userRoute.POST("/:id/test", controller.RunGroupStatusTest)
	}
}
