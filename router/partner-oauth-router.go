package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func SetPartnerOAuthRouter(router *gin.Engine) {
	oauth := router.Group("/")
	oauth.Use(middleware.RouteTag("api"), middleware.PartnerOAuthRequestID(), middleware.PartnerOAuthNoStore())
	{
		oauth.GET("/oauth/authorize", middleware.PartnerOAuthRateLimit("POA-AUTHZ", 30, 60, "oauth"), controller.PartnerOAuthAuthorize)
		oauth.POST("/oauth/token", middleware.PartnerOAuthRateLimit("POA-TOKEN", 60, 60, "oauth"), controller.PartnerOAuthToken)
		oauth.POST("/oauth/revoke", middleware.PartnerOAuthRateLimit("POA-REVOKE", 60, 60, "oauth"), controller.PartnerOAuthRevoke)
	}

	integration := router.Group("/api/integrations/v1")
	// The per-IP budget only caps floods; PartnerOAuthBearer adds the per-binding limit.
	integration.Use(middleware.RouteTag("api"), middleware.PartnerOAuthRequestID(), middleware.PartnerOAuthNoStore(), middleware.PartnerOAuthRateLimit("POA-INT", 1200, 60, "integration"))
	{
		integration.GET("/account", middleware.PartnerOAuthBearer(service.PartnerOAuthScopeAccountRead), controller.PartnerOAuthAccount)
		integration.POST("/credential", middleware.PartnerOAuthBearer(service.PartnerOAuthScopeCredentialRead), controller.PartnerOAuthCredential)
		integration.GET("/balance", middleware.PartnerOAuthBearer(service.PartnerOAuthScopeAccountRead), controller.PartnerOAuthBalance)
		integration.GET("/payment/options", middleware.PartnerOAuthBearer(service.PartnerOAuthScopePaymentWrite), controller.PartnerOAuthPaymentOptions)
		integration.POST("/payment/orders", middleware.PartnerOAuthBearer(service.PartnerOAuthScopePaymentWrite), controller.PartnerOAuthCreatePaymentOrder)
		integration.GET("/payment/orders/:order_id", middleware.PartnerOAuthBearer(service.PartnerOAuthScopePaymentWrite), controller.PartnerOAuthGetPaymentOrder)
	}

	consent := router.Group("/api/partner-oauth")
	consent.Use(middleware.RouteTag("api"), middleware.PartnerOAuthRequestID(), middleware.DisableCache(), middleware.UserAuth(), middleware.CriticalRateLimit())
	{
		consent.GET("/authorization", controller.PartnerOAuthInspectAuthorization)
		consent.POST("/authorization/decision", controller.PartnerOAuthDecideAuthorization)
	}
}
