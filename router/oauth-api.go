package router

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/service/hydra"

	"github.com/gin-gonic/gin"
)

// SetOAuthAPIRouter sets up OAuth API routes for third-party applications
// These routes allow OAuth clients to access new-api resources using OAuth tokens
func SetOAuthAPIRouter(router *gin.Engine) {
	if !common.HydraEnabled {
		return
	}

	// Initialize Hydra service for token introspection
	hydraService := hydra.NewService(common.HydraAdminURL)

	// OAuth API routes (for third-party applications)
	oauthAPI := router.Group("/api/v1/oauth")
	oauthAPI.Use(middleware.GlobalAPIRateLimit())
	oauthAPI.Use(middleware.OAuthTokenAuth(hydraService))
	{
		// User information (scope: openid or profile)
		oauthAPI.GET("/userinfo", middleware.RequireScope("openid"), controller.OAuthGetUserInfo)

		// Balance (scope: balance:read)
		oauthAPI.GET("/balance", middleware.RequireScope("balance:read"), controller.OAuthGetBalance)

		// Usage (scope: usage:read)
		oauthAPI.GET("/usage", middleware.RequireScope("usage:read"), controller.OAuthGetUsage)

		// Token management
		oauthAPI.GET("/tokens", middleware.RequireScope("tokens:read"), controller.OAuthListTokens)
		oauthAPI.POST("/tokens", middleware.RequireScope("tokens:write"), controller.OAuthCreateToken)
		oauthAPI.DELETE("/tokens/:id", middleware.RequireScope("tokens:write"), controller.OAuthDeleteToken)
	}
}
