package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func registerChannelContributionRoutes(apiRouter *gin.RouterGroup) {
	adminRoute := apiRouter.Group("/channel-contributions/admin")
	adminRoute.Use(middleware.AdminAuth())
	{
		adminRoute.GET("/settings", controller.GetAdminChannelContributionSettings)
		adminRoute.PUT("/settings", controller.UpdateAdminChannelContributionSettings)
		adminRoute.GET("", controller.ListAdminChannelContributions)
		adminRoute.GET("/:id", controller.GetAdminChannelContribution)
		adminRoute.POST("/:id/test-runs", controller.CreateAdminChannelContributionTestRun)
		adminRoute.GET("/:id/test-runs/:runId", controller.GetAdminChannelContributionTestRun)
		adminRoute.POST("/:id/approve", controller.ApproveAdminChannelContribution)
		adminRoute.POST("/:id/reject", controller.RejectAdminChannelContribution)
		adminRoute.DELETE("/:id", controller.DeleteAdminChannelContribution)
	}

	userRoute := apiRouter.Group("/channel-contributions")
	userRoute.Use(middleware.UserAuth())
	{
		userRoute.GET("/config", controller.GetChannelContributionConfig)
		userRoute.GET("/rewards", controller.GetChannelContributionRewards)
		userRoute.GET("/reward-transfers", controller.ListChannelContributionRewardTransfers)
		userRoute.POST("/reward-transfers", middleware.UserCriticalRateLimit("channel-contribution-reward-transfer"), controller.TransferChannelContributionReward)
		userRoute.GET("", controller.ListUserChannelContributions)
		userRoute.POST("", controller.CreateChannelContribution)
		userRoute.GET("/:id", controller.GetUserChannelContribution)
		userRoute.PUT("/:id", controller.UpdateUserChannelContribution)
		userRoute.POST("/:id/fetch-models", middleware.UserCriticalRateLimit("channel-contribution-fetch-models"), controller.FetchChannelContributionModels)
		userRoute.POST("/:id/test-runs", middleware.UserCriticalRateLimit("channel-contribution-test"), controller.CreateUserChannelContributionTestRun)
		userRoute.GET("/:id/test-runs/:runId", controller.GetUserChannelContributionTestRun)
		userRoute.POST("/:id/submit", middleware.UserCriticalRateLimit("channel-contribution-submit"), middleware.TurnstileCheck(), controller.SubmitUserChannelContribution)
		userRoute.POST("/:id/withdraw", controller.WithdrawUserChannelContribution)
	}
}
