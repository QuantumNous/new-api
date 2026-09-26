package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
)

func SetVolcengineAssetRouter(router *gin.Engine) {
	assets := router.Group("/v1/volcengine/assets")
	assets.Use(
		middleware.RouteTag("relay"),
		middleware.TokenAuth(),
		middleware.SystemPerformanceCheck(),
		middleware.TaskPluginChannelIdentity("sls-seedance", "doubao-seedance-2-0"),
		middleware.ModelRequestRateLimit(),
		middleware.Distribute(),
	)
	assets.POST("", controller.CreateVolcengineAsset)
	assets.GET("", controller.ListVolcengineAssets)
	assets.POST("/auth-sessions", controller.CreateVolcengineAuthSession)
	assets.POST("/groups/by-byted-token", controller.GetVolcenginePersonGroup)
	assets.GET("/:logical_id", controller.GetVolcengineAsset)
	assets.DELETE("/:logical_id", controller.DeleteVolcengineAsset)
}
