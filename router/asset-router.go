package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
)

func SetBytePlusAssetRouter(router *gin.Engine) {
	assetRouter := router.Group("/v1")
	assetRouter.Use(middleware.RouteTag("asset"))
	assetRouter.Use(middleware.GlobalAPIRateLimit())
	assetRouter.Use(middleware.TokenAuth())
	{
		assetRouter.POST("/assets", controller.CreateBytePlusAsset)
		assetRouter.GET("/assets/:asset_id", controller.GetBytePlusAsset)
	}
}
