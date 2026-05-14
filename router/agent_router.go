package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
)

func SetAgentRouter(router *gin.Engine) {
	agentRoute := router.Group("/api/agent")
	agentRoute.Use(middleware.RouteTag("agent"))
	agentRoute.Use(middleware.BodyStorageCleanup())
	agentRoute.Use(middleware.UserAuth())
	{
		agentRoute.GET("/config", controller.GetAgentConfig)
		agentRoute.POST("/chat", controller.AgentChat)
		agentRoute.POST("/confirm", controller.AgentConfirm)
		agentRoute.GET("/sessions", controller.ListAgentSessions)
		agentRoute.GET("/sessions/:id", controller.GetAgentSession)
		agentRoute.DELETE("/sessions/:id", controller.DeleteAgentSession)
		agentRoute.GET("/tools", controller.ListAgentTools)
		agentRoute.GET("/kb/search", controller.SearchAgentKnowledge)
	}

	adminRoute := router.Group("/api/agent/admin")
	adminRoute.Use(middleware.RouteTag("agent-admin"))
	adminRoute.Use(middleware.BodyStorageCleanup())
	adminRoute.Use(middleware.AdminAuth())
	{
		adminRoute.GET("/settings", controller.AdminGetAgentSettings)
		adminRoute.GET("/tools", controller.AdminListAgentTools)
		adminRoute.PUT("/tools/:name", controller.AdminUpdateAgentTool)
		adminRoute.GET("/audit", controller.AdminListAgentAudit)
		adminRoute.GET("/kb/docs", controller.AdminListAgentKBDocs)
		adminRoute.POST("/kb/docs", controller.AdminCreateAgentKBDoc)
		adminRoute.DELETE("/kb/docs/:id", controller.AdminDeleteAgentKBDoc)
	}
}
