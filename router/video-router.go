package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func SetVideoRouter(router *gin.Engine) {
	// Video proxy: accepts either session auth (dashboard) or token auth (API clients)
	videoProxyRouter := router.Group("/v1")
	videoProxyRouter.Use(middleware.RouteTag("relay"))
	videoProxyRouter.Use(middleware.TokenOrUserAuth())
	{
		videoProxyRouter.GET("/videos/:task_id/content", controller.VideoProxy)
	}

	videoV1Router := router.Group("/v1")
	videoV1Router.Use(middleware.RouteTag("relay"))
	videoV1Router.Use(middleware.TokenAuth(), middleware.Distribute())
	{
		videoV1Router.POST("/video/generations", controller.RelayTask)
		videoV1Router.GET("/video/generations/:task_id", controller.RelayTaskFetch)
		videoV1Router.POST("/videos/:video_id/remix", controller.RelayTask)
	}
	// openai compatible API video routes
	// docs: https://platform.openai.com/docs/api-reference/videos/create
	{
		videoV1Router.POST("/videos", controller.RelayTask)
		videoV1Router.GET("/videos/:task_id", controller.RelayTaskFetch)
	}

	klingV1Router := router.Group("/kling/v1")
	klingV1Router.Use(middleware.RouteTag("relay"))
	klingV1Router.Use(middleware.KlingRequestConvert(), middleware.TokenAuth(), middleware.Distribute())
	{
		klingV1Router.POST("/videos/text2video", controller.RelayTask)
		klingV1Router.POST("/videos/image2video", controller.RelayTask)
		klingV1Router.GET("/videos/text2video/:task_id", controller.RelayTaskFetch)
		klingV1Router.GET("/videos/image2video/:task_id", controller.RelayTaskFetch)
	}

	// Jimeng official API routes - direct mapping to official API format
	jimengOfficialGroup := router.Group("jimeng")
	jimengOfficialGroup.Use(middleware.RouteTag("relay"))
	jimengOfficialGroup.Use(middleware.JimengRequestConvert(), middleware.TokenAuth(), middleware.Distribute())
	{
		// Maps to: /?Action=CVSync2AsyncSubmitTask&Version=2022-08-31 and /?Action=CVSync2AsyncGetResult&Version=2022-08-31
		jimengOfficialGroup.POST("/", controller.RelayTask)
	}

	// Doubao Asset API - per-user isolated asset operations.
	// Token auth + per-user rate limit; each user only sees/manages assets in their own auto-managed group.
	doubaoAssetGroup := router.Group("/doubao/open")
	doubaoAssetGroup.Use(middleware.RouteTag("relay"))
	doubaoAssetGroup.Use(middleware.TokenAuth(), middleware.AssetRateLimit())
	{
		doubaoAssetGroup.POST("/ListAssets", controller.RelayListAssets)
		doubaoAssetGroup.POST("/GetAsset", controller.RelayGetAsset)
		doubaoAssetGroup.POST("/CreateAsset", controller.RelayCreateAsset)
		doubaoAssetGroup.POST("/UpdateAsset", controller.RelayUpdateAsset)
		doubaoAssetGroup.POST("/DeleteAsset", controller.RelayDeleteAsset)
	}

	// Doubao Asset Group management - admin only.
	// Regular users' groups are auto-managed; group CRUD is not exposed to them to preserve isolation.
	doubaoAssetGroupAdmin := router.Group("/doubao/open")
	doubaoAssetGroupAdmin.Use(middleware.RouteTag("relay"))
	doubaoAssetGroupAdmin.Use(middleware.TokenAuth(), middleware.AssetRateLimit(), middleware.AssetGroupAdminOnly())
	{
		doubaoAssetGroupAdmin.POST("/CreateAssetGroup", controller.RelayCreateAssetGroup)
		doubaoAssetGroupAdmin.POST("/ListAssetGroups", controller.RelayListAssetGroups)
		doubaoAssetGroupAdmin.POST("/GetAssetGroup", controller.RelayGetAssetGroup)
		doubaoAssetGroupAdmin.POST("/UpdateAssetGroup", controller.RelayUpdateAssetGroup)
		doubaoAssetGroupAdmin.POST("/DeleteAssetGroup", controller.RelayDeleteAssetGroup)
	}
}
