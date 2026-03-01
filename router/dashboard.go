package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/go-fuego/fuego"
)

func SetDashboardRouter(router *gin.Engine, engine *fuego.Engine) {
	apiRouter := router.Group("/")
	apiRouter.Use(middleware.RouteTag("old_api"))
	apiRouter.Use(gzip.Gzip(gzip.DefaultCompression))
	apiRouter.Use(middleware.GlobalAPIRateLimit())
	apiRouter.Use(middleware.CORS())
	apiRouter.Use(middleware.TokenAuth())
	dash := dto.NewRouter(engine, apiRouter, "Dashboard", secToken())
	{
		dash.GinGet("/dashboard/billing/subscription", controller.GetSubscription, dto.GinResp[dto.OpenAISubscriptionResponse]())
		dash.GinGet("/v1/dashboard/billing/subscription", controller.GetSubscription, dto.GinResp[dto.OpenAISubscriptionResponse]())
		dash.GinGet("/dashboard/billing/usage", controller.GetUsage, dto.GinResp[dto.OpenAIUsageResponse]())
		dash.GinGet("/v1/dashboard/billing/usage", controller.GetUsage, dto.GinResp[dto.OpenAIUsageResponse]())
	}
}
