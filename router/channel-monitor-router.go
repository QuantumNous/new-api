package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func registerChannelMonitorRoutes(apiRouter *gin.RouterGroup) {
	monitorRoute := apiRouter.Group("/channel_monitor")
	monitorRoute.Use(middleware.RootAuth())
	{
		monitorRoute.GET("/", controller.GetChannelMonitorOverview)
		monitorRoute.GET("/performance", controller.GetChannelMonitorPerformance)
		monitorRoute.GET("/success/detail", controller.GetChannelMonitorSuccessDetail)
		monitorRoute.GET("/tasks", controller.ListChannelMonitorTasks)
		monitorRoute.PUT("/settings", controller.UpdateChannelMonitorSettings)
		monitorRoute.POST("/ratio/run", controller.RunChannelMonitorRatioUpdate)
		monitorRoute.POST("/schedule/run", controller.RunChannelMonitorSmartSchedule)
		monitorRoute.PUT("/order", controller.UpdateChannelMonitorChannelOrder)
		monitorRoute.PUT("/channel/:id", controller.UpdateChannelMonitorRatio)
		monitorRoute.PUT("/channel/:id/schedule", controller.UpdateChannelMonitorSmartScheduleConfig)
		monitorRoute.GET("/channel/:id/history", controller.GetChannelMonitorHistory)
		monitorRoute.PUT("/channel/:id/upstream", controller.SaveChannelMonitorUpstreamConfig)
		monitorRoute.POST("/channel/:id/upstream/groups", controller.ListChannelMonitorUpstreamGroups)
		monitorRoute.POST("/channel/:id/upstream/version", controller.FetchChannelMonitorSub2APIUpstreamVersion)
		monitorRoute.POST("/channel/:id/upstream/test", controller.TestChannelMonitorUpstreamConfig)
		monitorRoute.POST("/channel/:id/upstream/fetch", controller.FetchChannelMonitorUpstreamRatio)
		monitorRoute.POST("/channel/:id/upstream/balance/fetch", controller.FetchChannelMonitorUpstreamBalance)
		monitorRoute.POST("/channel/:id/upstream/group/apply", controller.ApplyChannelMonitorUpstreamGroup)
		monitorRoute.PUT("/group", controller.UpdateChannelMonitorGroupRatio)
		monitorRoute.PUT("/group/sync", controller.SyncChannelMonitorGroupRatio)
	}
}
