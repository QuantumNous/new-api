package group_monitor

import (
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes 注册分组监控相关路由
func RegisterRoutes(apiRouter *gin.RouterGroup) {
	// 管理员接口
	adminRoute := apiRouter.Group("/group/monitor")
	adminRoute.Use(middleware.AdminAuth())
	{
		adminRoute.GET("/logs", GetGroupMonitorLogsHandler)
		adminRoute.GET("/latest", GetGroupMonitorLatestHandler)
		adminRoute.GET("/stats", GetGroupMonitorStatsHandler)
		adminRoute.GET("/time_series", GetGroupMonitorTimeSeriesHandler)
		adminRoute.GET("/configs", GetGroupMonitorConfigsHandler)
		adminRoute.POST("/configs", SaveGroupMonitorConfigHandler)
		adminRoute.DELETE("/configs/:group", DeleteGroupMonitorConfigHandler)
	}

	// 用户接口
	userRoute := apiRouter.Group("/group/monitor")
	userRoute.Use(middleware.UserAuth())
	{
		userRoute.GET("/status", GetGroupMonitorStatusHandler)
	}
}
