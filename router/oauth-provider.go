package router

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/service/hydra"

	"github.com/gin-gonic/gin"
)

// SetOAuthProviderRouter sets up OAuth provider routes for Hydra login/consent/logout flows
// These routes are used when new-api acts as a Login/Consent Provider for Ory Hydra
func SetOAuthProviderRouter(router *gin.Engine) {
	if !common.HydraEnabled {
		return
	}

	// Initialize Hydra service
	hydraService := hydra.NewService(common.HydraAdminURL)
	ctrl := controller.NewOAuthProviderController(hydraService)

	// OAuth provider API routes (for frontend to fetch data)
	oauthAPI := router.Group("/api/oauth")
	oauthAPI.Use(middleware.GlobalAPIRateLimit())
	{
		// Login flow
		// GET /api/oauth/login - Get login request info
		oauthAPI.GET("/login", ctrl.OAuthLogin)
		// POST /api/oauth/login - User submits login credentials
		oauthAPI.POST("/login", middleware.CriticalRateLimit(), ctrl.OAuthLoginSubmit)
		// POST /api/oauth/login/2fa - User submits 2FA code during OAuth login
		oauthAPI.POST("/login/2fa", middleware.CriticalRateLimit(), ctrl.OAuthLogin2FA)

		// Consent flow
		// GET /api/oauth/consent - Get consent request info
		oauthAPI.GET("/consent", ctrl.OAuthConsent)
		// POST /api/oauth/consent - User grants consent with selected scopes
		oauthAPI.POST("/consent", ctrl.OAuthConsentSubmit)
		// POST /api/oauth/consent/reject - User rejects consent
		oauthAPI.POST("/consent/reject", ctrl.OAuthConsentReject)

		// Logout flow
		// GET /api/oauth/logout - Handle logout
		oauthAPI.GET("/logout", ctrl.OAuthLogout)
	}

	// Admin client management routes (requires admin auth)
	adminClients := router.Group("/api/oauth/admin/clients")
	adminClients.Use(middleware.GlobalAPIRateLimit())
	adminClients.Use(middleware.AdminAuth())
	{
		adminClients.GET("", ctrl.OAuthListClients)
		adminClients.POST("", ctrl.OAuthRegisterClient)
		adminClients.PUT("/:id", ctrl.OAuthUpdateClient)
		adminClients.DELETE("/:id", ctrl.OAuthDeleteClient)
	}
}
