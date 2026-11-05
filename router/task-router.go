package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
)

// SetTaskRouter registers the generic task-plugin API surface.
//
// Gin requires every route sharing a path position to use the same wildcard
// name, so the first segment is uniformly ":key"; it carries the plugin key
// on submit routes and the task id on read routes.
func SetTaskRouter(router *gin.Engine) {
	// Submitting a task starts billable work, so a free trial account goes
	// through the same frozen check and request budget as a relay call. The read
	// routes below spend nothing and stay outside that budget; polling them would
	// otherwise exhaust the day within a few tasks.
	taskSubmitRouter := router.Group("/v1/tasks")
	taskSubmitRouter.Use(middleware.RouteTag("relay"), middleware.HwMask(), middleware.TokenAuth(), middleware.HwFreeGroupRateLimit())
	{
		taskSubmitRouter.POST("/:key", middleware.PrepareTaskPluginSubmit(), middleware.Distribute(), controller.RelayTask)
	}

	taskReadRouter := router.Group("/v1/tasks")
	taskReadRouter.Use(middleware.RouteTag("relay"), middleware.HwMask(), middleware.TokenAuth())
	{
		taskReadRouter.GET("/:key", controller.GetTask)
		taskReadRouter.GET("/:key/artifacts", controller.GetTaskArtifacts)
	}

	taskContentRouter := router.Group("/v1/tasks")
	taskContentRouter.Use(
		middleware.RouteTag("relay"),
		middleware.HwMask(),
		middleware.TokenOrTaskArtifactAccessAuth("key", "artifact_key"),
	)
	{
		taskContentRouter.GET("/:key/artifacts/:artifact_key/content", controller.TaskArtifactContent)
		taskContentRouter.HEAD("/:key/artifacts/:artifact_key/content", controller.TaskArtifactContent)
	}
}
