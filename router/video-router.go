package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
	"github.com/go-fuego/fuego"
)

func SetVideoRouter(router *gin.Engine, engine *fuego.Engine) {
	// Video proxy: accepts either session auth (dashboard) or token auth (API clients)
	videoProxyRouter := router.Group("/v1")
	videoProxyRouter.Use(middleware.RouteTag("relay"))
	videoProxyRouter.Use(middleware.TokenOrUserAuth())
	proxy := dto.NewRouter(engine, videoProxyRouter, "Video", secTokenOrDashboard())
	{
		proxy.GinGet("/videos/:task_id/content", controller.VideoProxy, dto.GinResp[dto.TaskResponseDoc]())
	}

	videoV1Router := router.Group("/v1")
	videoV1Router.Use(middleware.RouteTag("relay"))
	videoV1Router.Use(middleware.TokenAuth(), middleware.Distribute())
	video := dto.NewRouter(engine, videoV1Router, "Video", secToken())
	{
		video.GinPost("/video/generations", controller.RelayTask, dto.GinResp[dto.TaskResponseDoc]())
		video.GinGet("/video/generations/:task_id", controller.RelayTaskFetch, dto.GinResp[dto.TaskResponseDoc]())
		video.GinPost("/videos/:video_id/remix", controller.RelayTask, dto.GinResp[dto.TaskResponseDoc]())
	}
	// openai compatible API video routes
	// docs: https://platform.openai.com/docs/api-reference/videos/create
	{
		video.GinPost("/videos", controller.RelayTask, dto.GinResp[dto.TaskResponseDoc]())
		video.GinGet("/videos/:task_id", controller.RelayTaskFetch, dto.GinResp[dto.TaskResponseDoc]())
	}

	klingV1Router := router.Group("/kling/v1")
	klingV1Router.Use(middleware.RouteTag("relay"))
	klingV1Router.Use(middleware.KlingRequestConvert(), middleware.TokenAuth(), middleware.Distribute())
	kling := dto.NewRouter(engine, klingV1Router, "Video", secToken())
	{
		kling.GinPost("/videos/text2video", controller.RelayTask, dto.GinResp[dto.TaskResponseDoc]())
		kling.GinPost("/videos/image2video", controller.RelayTask, dto.GinResp[dto.TaskResponseDoc]())
		kling.GinGet("/videos/text2video/:task_id", controller.RelayTaskFetch, dto.GinResp[dto.TaskResponseDoc]())
		kling.GinGet("/videos/image2video/:task_id", controller.RelayTaskFetch, dto.GinResp[dto.TaskResponseDoc]())
	}

	// Jimeng official API routes - direct mapping to official API format
	jimengOfficialGroup := router.Group("jimeng")
	jimengOfficialGroup.Use(middleware.RouteTag("relay"))
	jimengOfficialGroup.Use(middleware.JimengRequestConvert(), middleware.TokenAuth(), middleware.Distribute())
	jimeng := dto.NewRouter(engine, jimengOfficialGroup, "Video", secToken())
	{
		// Maps to: /?Action=CVSync2AsyncSubmitTask&Version=2022-08-31 and /?Action=CVSync2AsyncGetResult&Version=2022-08-31
		jimeng.GinPost("/", controller.RelayTask, dto.GinResp[dto.TaskResponseDoc]())
	}
}
