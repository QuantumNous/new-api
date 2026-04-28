package router

import (
	"net/http"

	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/middleware"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

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

	// Volc Ark compatible task routes — native pass-through (no body rewriting).
	// Body bytes flow byte-identical to upstream without any normalization.
	// relay_format = "volc" signals RelayTask / RelayTaskFetch to use RelayFormatVolc
	// so the downstream adaptor forwards the body byte-identical to upstream.
	volcV3Router := router.Group("/api/v3")
	volcV3Router.Use(middleware.RouteTag("relay"))
	volcV3Router.Use(middleware.TokenAuth(), middleware.Distribute())
	{
		// Task submit: native Volc body forwarded to upstream unchanged.
		volcV3Router.POST("/contents/generations/tasks", func(c *gin.Context) {
			c.Set("relay_format", string(types.RelayFormatVolc))
			controller.RelayTask(c)
		})

		// Task list: set relay_mode and relay_format for the list builder.
		volcV3Router.GET("/contents/generations/tasks", func(c *gin.Context) {
			c.Set("relay_format", string(types.RelayFormatVolc))
			c.Set("relay_mode", relayconstant.RelayModeVideoFetchList)
			controller.RelayTaskFetch(c)
		})

		// Task fetch by ID: set task_id, relay_mode, and relay_format.
		volcV3Router.GET("/contents/generations/tasks/:id", func(c *gin.Context) {
			c.Set("relay_format", string(types.RelayFormatVolc))
			taskID := c.Param("id")
			c.Set("task_id", taskID)
			c.Set("relay_mode", relayconstant.RelayModeVideoFetchByID)
			controller.RelayTaskFetch(c)
		})

		// Task delete: not yet implemented.
		volcV3Router.DELETE("/contents/generations/tasks/:id", func(c *gin.Context) {
			c.JSON(http.StatusNotImplemented, &dto.TaskError{
				Code:       "not_implemented",
				Message:    "DELETE /api/v3/contents/generations/tasks/:id is not supported yet",
				StatusCode: http.StatusNotImplemented,
			})
		})
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
