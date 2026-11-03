package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
)

func SetPartnerTenantRouter(router *gin.Engine) {
	partner := router.Group("/api/partner/v1")
	partner.Use(
		middleware.RouteTag("api"),
		middleware.PartnerOAuthRequestID(),
		middleware.PartnerOAuthNoStore(),
		middleware.PartnerOAuthRateLimit("PT-INT", 3000, 60, "integration"),
		middleware.PartnerTenantBearer(),
	)
	{
		partner.GET("/plans", controller.PartnerTenantListPlans)
		partner.PUT("/accounts", controller.PartnerTenantProvisionAccount)
		partner.POST("/accounts/:external_user_id/subscriptions", controller.PartnerTenantGrantSubscription)
		partner.GET("/accounts/:external_user_id/subscription/quota", controller.PartnerTenantSubscriptionQuota)
	}
}
