package router

import (
	"github.com/QuantumNous/new-api/common"
	skillhandler "github.com/QuantumNous/new-api/internal/skill/handler"
	"github.com/QuantumNous/new-api/middleware"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

func SetSkillRouter(router *gin.Engine) {
	if platformmodel.DB != nil {
		skillhandler.SetDB(platformmodel.DB)
	}

	v1 := router.Group("/api/v1")
	v1.Use(middleware.RouteTag("skill_api"))
	v1.Use(gzip.Gzip(gzip.DefaultCompression))
	v1.Use(middleware.BodyStorageCleanup())
	{
		marketplaceRoute := v1.Group("/marketplace")
		marketplaceRoute.Use(middleware.TryUserAuth())
		if common.GlobalApiRateLimitEnable {
			marketplaceRoute.Use(middleware.SkillRateLimit(common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration, "SKM"))
		}
		{
			marketplaceRoute.GET("/skills", skillhandler.ListMarketplaceSkills)
			marketplaceRoute.GET("/skills/:id", skillhandler.GetMarketplaceSkill)
		}

		downloadRoute := v1.Group("/marketplace")
		downloadRoute.Use(middleware.SkillUserAuth())
		if common.GlobalApiRateLimitEnable {
			downloadRoute.Use(middleware.SkillRateLimit(common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration, "SKD"))
		}
		{
			downloadRoute.GET("/skills/:id/download", skillhandler.DownloadSkillPackage)
		}

		adminRoute := v1.Group("/admin")
		adminRoute.Use(middleware.SkillRootAuth())
		if common.GlobalApiRateLimitEnable {
			adminRoute.Use(middleware.SkillUserRateLimit(common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration, "SKA"))
		}
		{
			adminRoute.GET("/skills", skillhandler.ListAdminSkills)
		}

		opsRoute := v1.Group("/ops")
		opsRoute.Use(middleware.SkillAdminAuth())
		if common.GlobalApiRateLimitEnable {
			opsRoute.Use(middleware.SkillUserRateLimit(common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration, "SKO"))
		}
		{
			opsRoute.GET("/skills/summary", skillhandler.GetOpsSkillSummary)
		}
	}
}
