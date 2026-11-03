package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
)

// SetPartnerServerRouter registers the partner server API. It must run before
// any engine-wide CORS middleware is added, so these routes never answer
// cross-origin requests from browsers.
func SetPartnerServerRouter(router *gin.Engine) {
	partner := router.Group("/api/partner/v1")
	partner.Use(middleware.RouteTag("api"), middleware.PartnerOAuthRequestID(), middleware.PartnerOAuthNoStore(), middleware.PartnerOAuthRateLimit("PSV-IP", 1200, 60, "integration"))
	partner.OPTIONS("/*path", middleware.PartnerServerRejectPreflight)

	accounts := partner.Group("/accounts/:external_user_id", middleware.PartnerServerBearer())
	{
		// Key reads and rotations share one per-partner budget.
		credentialLimit := middleware.PartnerServerRateLimit("PSV-CRED", middleware.PartnerServerCredentialRateLimit, "partner_account.credential_rate_limited")
		accounts.GET("", controller.PartnerServerGetAccount)
		accounts.POST("/credential", credentialLimit, controller.PartnerServerIssueCredential)
		accounts.POST("/credential/rotate", credentialLimit, controller.PartnerServerRotateCredential)
		accounts.POST("/disable", controller.PartnerServerDisableAccount)
		accounts.POST("/enable", controller.PartnerServerEnableAccount)
		accounts.POST("/payment/orders", controller.PartnerServerCreatePaymentOrder)
		accounts.GET("/usage", middleware.PartnerServerRateLimit("PSV-USAGE", middleware.PartnerServerUsageRateLimit, ""), controller.PartnerServerAccountUsage)
	}
	partner.GET("/payment/options", middleware.PartnerServerBearer(), controller.PartnerServerPaymentOptions)
	partner.GET("/payment/orders/:order_id", middleware.PartnerServerBearer(), controller.PartnerServerGetPaymentOrder)
}
