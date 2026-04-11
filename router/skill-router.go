package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// SetSkillRouter 设置技能相关路由
func SetSkillRouter(router *gin.Engine) {
	// 公开 API 路由（无需认证）
	skillPublicRoute := router.Group("/api/skill")
	skillPublicRoute.Use(middleware.RouteTag("api"))
	{
		// 获取技能列表（支持 tag 过滤和分页）
		skillPublicRoute.GET("/", controller.GetAllSkills)
		// 搜索技能
		skillPublicRoute.GET("/search", controller.SearchSkills)
		// 获取所有标签
		skillPublicRoute.GET("/tags", controller.GetAllSkillTags)
		// 获取单个技能详情
		skillPublicRoute.GET("/:id", controller.GetSkill)
		// 下载技能
		skillPublicRoute.GET("/download/:id", controller.DownloadSkill)
	}

	// 管理 API 路由（需要管理员权限）
	skillAdminRoute := router.Group("/api/skill")
	skillAdminRoute.Use(middleware.RouteTag("api"))
	skillAdminRoute.Use(middleware.AdminAuth())
	{
		// 创建技能
		skillAdminRoute.POST("/", controller.AddSkill)
		// 更新技能
		skillAdminRoute.PUT("/:id", controller.UpdateSkill)
		// 删除技能
		skillAdminRoute.DELETE("/:id", controller.DeleteSkill)
	}

	// 技能文件下载服务（静态文件）
	// 访问路径: /skills/downloads/{filename}
	router.Static("/skills/downloads", "./skills/downloads")
}
