package router

import (
	"github.com/QuantumNous/new-api/common"
	skillhandler "github.com/QuantumNous/new-api/internal/skill/handler"
	skillrelay "github.com/QuantumNous/new-api/internal/skill/relay"
	"github.com/QuantumNous/new-api/middleware"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

func SetSkillRouter(router *gin.Engine) {
	if platformmodel.DB != nil {
		skillhandler.SetDB(platformmodel.DB)
		skillrelay.SetDB(platformmodel.DB)
	}

	v1 := router.Group("/api/v1")
	v1.Use(middleware.RouteTag("skill_api"))
	v1.Use(gzip.Gzip(gzip.DefaultCompression))
	v1.Use(middleware.BodyStorageCleanup())
	{
		marketplaceRoute := v1.Group("/marketplace")
		marketplaceRoute.Use(middleware.TrySkillUserAuth())
		if common.GlobalApiRateLimitEnable {
			marketplaceRoute.Use(middleware.SkillRateLimit(common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration, "SKM"))
		}
		{
			marketplaceRoute.GET("/skills", skillhandler.ListMarketplaceSkills)
			marketplaceRoute.GET("/skills/:id", skillhandler.GetMarketplaceSkill)
			marketplaceRoute.POST("/skills/:id/events", skillhandler.RecordMarketplaceSkillEvent)
		}

		mySkillsRoute := v1.Group("/marketplace")
		mySkillsRoute.Use(middleware.SkillUserAuth())
		if common.GlobalApiRateLimitEnable {
			mySkillsRoute.Use(middleware.SkillUserRateLimit(common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration, "SKM"))
		}
		{
			mySkillsRoute.GET("/my-skills", skillhandler.ListMySkills)
			mySkillsRoute.DELETE("/my-skills/:id", skillhandler.RemoveMySkill)
		}

		downloadRoute := v1.Group("/marketplace")
		downloadRoute.Use(middleware.SkillUserAuth())
		if common.GlobalApiRateLimitEnable {
			downloadRoute.Use(middleware.SkillRateLimit(common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration, "SKD"))
		}
		{
			downloadRoute.GET("/skills/:id/download", skillhandler.DownloadSkillPackage)
			downloadRoute.GET("/skill-versions/:skill_version_id/download", skillhandler.DownloadSkillVersionPackage)
		}

		adminRoute := v1.Group("/admin")
		adminRoute.Use(middleware.SkillRootAuth())
		if common.GlobalApiRateLimitEnable {
			adminRoute.Use(middleware.SkillUserRateLimit(common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration, "SKA"))
		}
		{
			adminRoute.GET("/skills", skillhandler.ListAdminSkills)
			adminRoute.POST("/skills", skillhandler.CreateAdminSkill)
			adminRoute.PATCH("/skills/:skill_id", skillhandler.PatchAdminSkill)
			adminRoute.GET("/skills/:skill_id/audit-log", skillhandler.ListAdminSkillAuditLog)
			adminRoute.GET("/skills/:skill_id/versions", skillhandler.ListAdminSkillVersions)
			adminRoute.POST("/skills/:skill_id/versions", skillhandler.CreateAdminSkillVersion)
			adminRoute.GET("/skills/:skill_id/versions/:version_id", skillhandler.GetAdminSkillVersion)
			adminRoute.POST("/skills/:skill_id/versions/:version_id/activate", skillhandler.ActivateAdminSkillVersion)
			adminRoute.POST("/skills/:skill_id/publish", skillhandler.PublishAdminSkill)
		}

		opsRoute := v1.Group("/ops")
		opsRoute.Use(middleware.SkillAdminAuth())
		if common.GlobalApiRateLimitEnable {
			opsRoute.Use(middleware.SkillUserRateLimit(common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration, "SKO"))
		}
		{
			opsRoute.GET("/skills/summary", skillhandler.GetOpsSkillSummary)
			opsRoute.GET("/skill-analytics/overview", skillhandler.GetOpsSkillAnalyticsOverview)
			opsRoute.GET("/skill-analytics/skills", skillhandler.GetOpsSkillAnalyticsSkills)
		}
	}
}
