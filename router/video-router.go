package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func SetVideoRouter(router *gin.Engine) {
	videoSharedRouter := router.Group("/v1")
	videoSharedRouter.Use(middleware.RouteTag("relay"))
	videoSharedRouter.Use(middleware.HwMask())
	videoSharedRouter.Use(middleware.TokenAuth())
	// Starting a video generation is billable, so a free trial account goes
	// through the same frozen check and request budget as a relay call.
	videoSharedRouter.Use(middleware.HwFreeGroupRateLimit())
	videoSharedRouter.Use(middleware.SystemPerformanceCheck())
	videoSharedRouter.POST(
		"/video/generations",
		middleware.PinTaskPluginEndpoint(),
		middleware.TaskPluginEndpointOnly(middleware.ModelRequestRateLimit()),
		middleware.PrepareTaskPluginEndpoint(),
		middleware.Distribute(),
		func(c *gin.Context) {
			controller.RelayTaskPluginEndpoint(c, controller.RelayTask)
		},
	)

	// Fetching a running task is a poll and spends nothing, so the free-group
	// budget stays off that route.
	videoV1Router := router.Group("/v1")
	videoV1Router.Use(middleware.RouteTag("relay"))
	videoV1Router.Use(middleware.HwMask())
	videoV1Router.Use(middleware.TokenAuth(), middleware.Distribute())
	{
		videoV1Router.GET("/video/generations/:task_id", controller.RelayTaskFetch)
	}

	// A remix starts a new billable generation: same frozen check and budget as
	// a relay call.
	videoTaskRouter := router.Group("/v1")
	videoTaskRouter.Use(middleware.RouteTag("relay"))
	videoTaskRouter.Use(middleware.HwMask())
	videoTaskRouter.Use(middleware.TokenAuth(), middleware.HwFreeGroupRateLimit(), middleware.Distribute())
	{
		videoTaskRouter.POST("/videos/:video_id/remix", controller.RelayTask)
	}
}
