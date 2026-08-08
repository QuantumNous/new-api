package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func SetSeedanceOfficialRouter(router *gin.Engine) {
	g := router.Group("/api/seedance/official")
	g.Use(middleware.RouteTag("api"))
	g.Use(middleware.TokenAuth())
	{
		g.POST("/asset-groups", controller.SeedanceOfficialCreateAssetGroup)
		g.POST("/asset-groups/query", controller.SeedanceOfficialQueryAssetGroups)
		g.GET("/asset-groups/:group_id", controller.SeedanceOfficialGetAssetGroup)
		g.PATCH("/asset-groups/:group_id", controller.SeedanceOfficialPatchAssetGroup)
		g.DELETE("/asset-groups/:group_id", controller.SeedanceOfficialDeleteAssetGroup)

		g.POST("/assets/query", controller.SeedanceOfficialQueryAssets)
		g.POST("/assets", controller.SeedanceOfficialCreateRemoteAsset)
		g.GET("/assets/:id", controller.SeedanceOfficialGetAsset)
		g.PATCH("/assets/:id", controller.SeedanceOfficialPatchAsset)
		g.DELETE("/assets/:id", controller.SeedanceOfficialDeleteAsset)

		g.POST("/real-person-auth/sessions", controller.SeedanceOfficialCreateRealPersonSession)
		g.POST("/real-person-auth/asset-group", controller.SeedanceOfficialExchangeRealPersonAssetGroup)
	}
}
