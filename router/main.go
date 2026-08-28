package router

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func SetRouter(router *gin.Engine, assets WebAssets) {
	SetApiRouter(router)
	SetDashboardRouter(router)
	SetRelayRouter(router)
	SetVideoRouter(router)
	frontendBaseUrl := os.Getenv("FRONTEND_BASE_URL")
	if common.IsMasterNode && frontendBaseUrl != "" {
		frontendBaseUrl = ""
		common.SysLog("FRONTEND_BASE_URL is ignored on master node")
	}
	if frontendBaseUrl == "" {
		SetWebRouter(router, assets)
		// Register OAuth Provider endpoints on the root router AFTER SetWebRouter so they
		// take precedence over static file serving. The explicit route handlers above
		// static.Serve ensure these OIDC endpoints are never swallowed by the SPA fallback.
		registerPublicOAuthRoutes(router)
	} else {
		frontendBaseUrl = strings.TrimSuffix(frontendBaseUrl, "/")
		router.NoRoute(func(c *gin.Context) {
			c.Set(middleware.RouteTagKey, "web")
			c.Redirect(http.StatusMovedPermanently, fmt.Sprintf("%s%s", frontendBaseUrl, c.Request.RequestURI))
		})
	}
}

// registerPublicOAuthRoutes registers OAuth Provider (OIDC) endpoints on the root router.
// These routes must be registered AFTER SetWebRouter so they take precedence over the
// static file server. OIDC discovery requires /.well-known/openid-configuration on the root.
func registerPublicOAuthRoutes(router *gin.Engine) {
	// No middleware needed for these public OAuth endpoints.
	// The token endpoint accepts POST only (CSRF-safe), and authorize/userinfo are OAuth flows.
	router.GET("/oauth/authorize", controller.OAuthProviderAuthorize)
	router.POST("/oauth/authorize", controller.OAuthProviderAuthorizePost)
	router.POST("/oauth/token", controller.OAuthProviderToken)
	router.GET("/oauth/userinfo", controller.OAuthProviderUserInfo)
	router.GET("/.well-known/openid-configuration", controller.OAuthProviderWellKnown)
}
