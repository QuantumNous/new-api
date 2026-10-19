package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// SetYbRouter registers yb (yabaoai) face moderation proxy routes.
// Paths mirror upstream docs so clients only need to change the host.
func SetYbRouter(router *gin.Engine) {
	v1 := router.Group("/v1")
	v1.Use(middleware.RouteTag("api"))
	v1.Use(middleware.TokenAuth())
	{
		v1.POST("/moderation/face", controller.YbFaceModerationSubmit)
		v1.GET("/moderation/face/:task_id", controller.YbFaceModerationPoll)
	}

	api := router.Group("/api/yb")
	api.Use(middleware.RouteTag("api"))
	api.Use(middleware.TokenAuth())
	{
		api.POST("/moderation/face", controller.YbFaceModerationSubmit)
		api.GET("/moderation/face/:task_id", controller.YbFaceModerationPoll)
	}
}
