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
	assetRouter.Use(middleware.ModelRequestRateLimit())
	{
		assetRouter.POST("/assets", controller.CreateBytePlusAsset)
		assetRouter.GET("/assets/:asset_id", controller.GetBytePlusAsset)
		assetRouter.DELETE("/assets/:asset_id", controller.DeleteBytePlusAsset)
		assetRouter.POST("/real-persons", controller.CreateBytePlusRealPerson)
		assetRouter.POST("/real-persons/:person_id/verification-sessions", controller.ReverifyBytePlusRealPerson)
		assetRouter.GET("/real-persons", controller.ListBytePlusRealPersons)
		assetRouter.GET("/real-persons/:person_id", controller.GetBytePlusRealPerson)
		assetRouter.POST("/real-persons/:person_id/assets", controller.CreateBytePlusRealPersonAsset)
		assetRouter.GET("/real-persons/:person_id/assets", controller.ListBytePlusRealPersonAssets)
	}

	callbackRouter := router.Group("/v1/real-person-verifications")
	callbackRouter.Use(middleware.RouteTag("real_person_callback"))
	callbackRouter.Use(middleware.RealPersonVerificationCallbackMetrics())
	callbackRouter.Use(middleware.RealPersonVerificationCallbackRateLimit())
	{
		callbackRouter.GET("/callback/:callback_token", controller.BytePlusRealPersonVerificationCallback)
		callbackRouter.POST("/callback/:callback_token", controller.BytePlusRealPersonVerificationCallback)
	}
}
