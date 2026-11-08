package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// registerAuthzRoutes mounts the authorization API under its own /authz
// namespace. GET /authz/catalog returns the permission schema (resources,
// actions, and role baselines) used by the client permission editor.
func registerAuthzRoutes(apiRouter *gin.RouterGroup) {
	authzRoute := apiRouter.Group("/authz")
	authzRoute.Use(middleware.AdminAuth())
	// The catalog drives the permission matrix editor on the user management
	// page, so it follows the users section.
	authzRoute.Use(middleware.RequireVisibleSection("users"))
	{
		authzRoute.GET("/catalog", controller.GetPermissionCatalog)
	}
}
