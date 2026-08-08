package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
)

// P2 平台化能力：四个功能的管理端路由 + SLA 公开状态页。
// 前端页面与区域路由真实选渠道逻辑不在本轮范围。

func registerTeamRoutes(apiRouter *gin.RouterGroup) {
	r := apiRouter.Group("/admin/teams")
	r.Use(middleware.AdminAuth())
	{
		r.GET("", controller.ListTeams)
		r.POST("", controller.CreateTeam)
		r.GET("/:id", controller.GetTeam)
		r.PUT("/:id", controller.UpdateTeam)
		r.DELETE("/:id", controller.DeleteTeam)
		r.POST("/:id/members", controller.AddTeamMember)
		r.GET("/:id/members", controller.ListTeamMembers)
		r.DELETE("/:id/members/:user_id", controller.RemoveTeamMember)
		r.POST("/:id/projects", controller.AddTeamProject)
		r.GET("/:id/projects", controller.ListTeamProjects)
		r.DELETE("/:id/projects/:pid", controller.RemoveTeamProject)
		r.GET("/:id/billing", controller.GetTeamBilling)
	}
}

func registerSlaRoutes(apiRouter *gin.RouterGroup) {
	admin := apiRouter.Group("/admin/sla-incidents")
	admin.Use(middleware.AdminAuth())
	{
		admin.GET("", controller.ListSlaIncidents)
		admin.POST("", controller.CreateSlaIncident)
		admin.GET("/:id", controller.GetSlaIncident)
		admin.PUT("/:id", controller.UpdateSlaIncident)
		admin.DELETE("/:id", controller.DeleteSlaIncident)
	}
	// 公开匿名：状态页事件列表与服务状态摘要。
	apiRouter.GET("/sla/incidents", controller.GetPublicSlaIncidents)
	apiRouter.GET("/sla/status", controller.GetPublicSlaStatus)
}

func registerRegionRouteRoutes(apiRouter *gin.RouterGroup) {
	r := apiRouter.Group("/admin/region-routes")
	r.Use(middleware.AdminAuth())
	{
		r.GET("", controller.ListRegionRoutes)
		r.POST("", controller.CreateRegionRoute)
		r.GET("/:id", controller.GetRegionRoute)
		r.PUT("/:id", controller.UpdateRegionRoute)
		r.DELETE("/:id", controller.DeleteRegionRoute)
	}
}

func registerDistributorRoutes(apiRouter *gin.RouterGroup) {
	r := apiRouter.Group("/admin/distributors")
	r.Use(middleware.AdminAuth())
	{
		r.GET("", controller.ListDistributors)
		r.POST("", controller.CreateDistributor)
		r.GET("/:id", controller.GetDistributor)
		r.PUT("/:id", controller.UpdateDistributor)
		r.DELETE("/:id", controller.DeleteDistributor)
		r.GET("/:id/sub-users", controller.ListDistributorSubUsers)
		r.GET("/:id/billing", controller.GetDistributorBilling)
		r.GET("/:id/prices", controller.ListDistributorPrices)
		r.POST("/:id/prices", controller.CreateDistributorPrice)
		r.PUT("/:id/prices/:price_id", controller.UpdateDistributorPrice)
		r.DELETE("/:id/prices/:price_id", controller.DeleteDistributorPrice)
	}
}
