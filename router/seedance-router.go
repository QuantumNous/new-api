package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func SetSeedanceRouter(router *gin.Engine) {
	g := router.Group("/api/seedance")
	g.Use(middleware.RouteTag("api"))
	g.Use(middleware.TokenAuth())
	{
		g.POST("/asset-groups", controller.SeedanceCreateAssetGroup)
		g.POST("/asset-groups/query", controller.SeedanceQueryAssetGroups)
		g.GET("/asset-groups/:group_id", controller.SeedanceGetAssetGroup)
		g.PATCH("/asset-groups/:group_id", controller.SeedancePatchAssetGroup)
		g.DELETE("/asset-groups/:group_id", controller.SeedanceDeleteAssetGroup)

		g.POST("/assets/query", controller.SeedanceQueryAssets)
		g.POST("/assets", controller.SeedanceCreateRemoteAsset)
		g.GET("/assets/:id", controller.SeedanceGetAsset)
		g.PATCH("/assets/:id", controller.SeedancePatchAsset)
		g.DELETE("/assets/:id", controller.SeedanceDeleteAsset)

		g.POST("/real-person-auth/sessions", controller.SeedanceCreateRealPersonSession)
		g.POST("/real-person-auth/asset-group", controller.SeedanceExchangeRealPersonAssetGroup)
	}
}
