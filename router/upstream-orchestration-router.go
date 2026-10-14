package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
)

func registerUpstreamOrchestrationRoutes(apiRouter *gin.RouterGroup) {
	root := apiRouter.Group("/upstream-orchestration")
	root.Use(middleware.RootAuth())
	{
		root.GET("/overview", controller.GetUpstreamOrchestrationOverview)
		root.GET("/routes", controller.ListUpstreamOrchestrationRoutes)
		root.GET("/metrics", controller.ListUpstreamOrchestrationMetrics)
		root.GET("/prices", controller.ListUpstreamPriceEvidence)
		root.PUT("/settings", middleware.CriticalRateLimit(), controller.UpdateUpstreamOrchestrationSettings)
		root.POST("/devices/pairing-code", middleware.CriticalRateLimit(), middleware.DisableCache(), controller.CreateUpstreamPairingCode)
		root.DELETE("/devices/:device_id", middleware.CriticalRateLimit(), middleware.DisableCache(), controller.RevokeUpstreamDevice)
		root.PUT("/sources/:id", middleware.CriticalRateLimit(), controller.UpdateUpstreamSource)
		root.POST("/sync-request", middleware.CriticalRateLimit(), controller.RequestUpstreamSync)
		root.POST("/reconcile", middleware.CriticalRateLimit(), controller.ReconcileUpstreamRoutes)
		root.POST("/routes/:id/probe", middleware.CriticalRateLimit(), controller.ProbeUpstreamRoute)
		root.POST("/routes/:id/pause", middleware.CriticalRateLimit(), controller.PauseUpstreamRoute)
		root.POST("/routes/:id/resume", middleware.CriticalRateLimit(), controller.ResumeUpstreamRoute)
		root.POST("/routes/:id/detach", middleware.CriticalRateLimit(), controller.DetachUpstreamRoute)
	}

	device := apiRouter.Group("/upstream-orchestration/device")
	device.Use(middleware.DisableCache())
	{
		device.POST("/pair", middleware.CriticalRateLimit(), controller.PairUpstreamDevice)
		device.GET("/commands", controller.ListUpstreamDeviceCommands)
		device.POST("/snapshots", controller.IngestUpstreamSnapshot)
		device.POST("/commands/:command_id/result", controller.CompleteUpstreamDeviceCommand)
		device.POST("/enrollments/:command_id/result", controller.CompleteUpstreamEnrollment)
	}
}
