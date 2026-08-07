package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func SetVideoRouter(router *gin.Engine) {
	// Locally generated public task IDs are capability URLs. Legacy task IDs
	// still require either session auth (dashboard) or token auth (API clients).
	videoProxyRouter := router.Group("/v1")
	videoProxyRouter.Use(middleware.RouteTag("relay"))
	videoProxyRouter.Use(middleware.VideoProxyAuth())
	{
		videoProxyRouter.GET("/videos/:task_id/content", controller.VideoProxy)
	}
	openAIVideoProxyRouter := router.Group("/openai/v1")
	openAIVideoProxyRouter.Use(middleware.RouteTag("relay"))
	openAIVideoProxyRouter.Use(middleware.VideoProxyAuth())
	{
		openAIVideoProxyRouter.GET("/videos/:task_id/content", controller.VideoProxy)
	}

	videoV1Router := router.Group("/v1")
	videoV1Router.Use(middleware.RouteTag("relay"))
	videoV1Router.Use(middleware.TokenAuth(), middleware.Distribute())
	{
		videoV1Router.POST("/video/generations", controller.RelayTask)
		videoV1Router.GET("/video/generations/:task_id", controller.RelayTaskFetch)
		videoV1Router.POST("/videos/:video_id/remix", controller.RelayTask)
	}
	// Native video routes. xAI channels preserve the CLIProxyAPI /v1/videos
	// request and response contract; other channels retain their existing format.
	{
		videoV1Router.POST("/videos", controller.RelayTask)
		videoV1Router.POST("/videos/generations", controller.RelayTask)
		videoV1Router.POST("/videos/edits", controller.RelayTask)
		videoV1Router.POST("/videos/extensions", controller.RelayTask)
		videoV1Router.GET("/videos/:task_id", controller.RelayTaskFetch)
	}

	// CLIProxyAPI OpenAI-compatible video routes. xAI channels translate these
	// to the upstream /openai/v1/videos contract while keeping /v1/videos native.
	openAIVideoRouter := router.Group("/openai/v1")
	openAIVideoRouter.Use(middleware.RouteTag("relay"))
	openAIVideoRouter.Use(middleware.TokenAuth(), middleware.Distribute())
	{
		openAIVideoRouter.POST("/videos", controller.RelayTask)
		openAIVideoRouter.GET("/videos/:task_id", controller.RelayTaskFetch)
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
}
