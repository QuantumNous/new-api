package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// SetInternalRouter registers the /internal/* group, used for sidecar-to-gateway
// communication (currently: smart-router's catalog polling). All routes here
// require the DEEPROUTER_INTERNAL_TOKEN Bearer auth and are NOT exposed to the
// public-facing /api/* surface or documented in the OpenAPI spec.
func SetInternalRouter(router *gin.Engine) {
	g := router.Group("/internal")
	g.Use(middleware.RouteTag("internal"))
	g.Use(middleware.InternalToken())
	{
		g.GET("/router-catalog", controller.GetRouterCatalog)
	}
}
