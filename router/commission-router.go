package router

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func SetCommissionRouter(router *gin.Engine) {
	// 用户端返佣API - 需要登录
	commissionRouter := router.Group("/api/user/commission")
	commissionRouter.Use(middleware.UserAuth())
	// A2: 总开关守卫 - 关闭时用户端接口返回明确拒绝
	commissionRouter.Use(func(c *gin.Context) {
		if !common.CommissionEnabled {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "返佣功能未开启"})
			c.Abort()
			return
		}
		c.Next()
	})
	{
		// 获取返佣信息
		commissionRouter.GET("/info", controller.GetUserCommissionInfo)

		// 获取返佣明细
		commissionRouter.GET("/logs", controller.GetUserCommissionLogs)

		// 获取返佣统计
		commissionRouter.GET("/stats", controller.GetUserCommissionStats)

		// 转移邀请额度到余额（资金操作，加频率限制）
		commissionRouter.POST("/transfer", middleware.CriticalRateLimit(), controller.TransferCommissionToQuota)

		// 获取消费返佣记录（作为被邀请人）
		commissionRouter.GET("/consumption", controller.GetUserConsumptionLogs)
	}

	// 管理员返佣API - 需要管理员权限
	adminCommissionRouter := router.Group("/api/admin/commission")
	adminCommissionRouter.Use(middleware.AdminAuth())
	{
		// 返佣规则管理
		adminCommissionRouter.GET("/rules", controller.AdminGetCommissionRules)
		adminCommissionRouter.POST("/rules", controller.AdminCreateCommissionRule)
		adminCommissionRouter.PUT("/rules/:id", controller.AdminUpdateCommissionRule)
		adminCommissionRouter.DELETE("/rules/:id", controller.AdminDeleteCommissionRule)
		adminCommissionRouter.PATCH("/rules/:id/toggle", controller.AdminToggleCommissionRule)

		// 返佣统计报表
		adminCommissionRouter.GET("/statistics", controller.AdminGetCommissionStatistics)

		// 返佣日志管理
		adminCommissionRouter.GET("/logs", controller.AdminGetCommissionLogs)

		// 手动结算
		adminCommissionRouter.POST("/settle", controller.AdminSettleCommission)

		// B4: 可疑活动检测端点
		adminCommissionRouter.GET("/suspicious/:user_id", controller.AdminDetectSuspicious)
	}
}
