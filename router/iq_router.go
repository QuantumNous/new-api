package router

import (
	"net/http"

	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
)

var iqAdminPermissionRoutes = []permissionRoute{
	{method: http.MethodGet, path: "/config", permission: authz.ChannelRead, handler: controller.GetIQConfig},
	{method: http.MethodPut, path: "/config", permission: authz.ChannelWrite, handler: controller.PutIQConfig},
	{method: http.MethodGet, path: "/targets", permission: authz.ChannelRead, handler: controller.GetIQTargets},
	{method: http.MethodPost, path: "/run", permission: authz.ChannelOperate, handler: controller.RunIQTests},
}

func registerIQRoutes(api *gin.RouterGroup) {
	iq := api.Group("/iq-tests")
	iq.Use(middleware.DisableCache())
	iq.GET("/results", middleware.UserAuth(), controller.GetIQResults)
	iq.GET("/results/:id", middleware.UserAuth(), controller.GetIQArtifact)
	admin := iq.Group("")
	admin.Use(middleware.AdminAuth())
	for _, r := range iqAdminPermissionRoutes {
		if r.method == http.MethodPost || r.method == http.MethodPut {
			handlePermissionRoute(admin, r.method, r.path, r.permission, middleware.CriticalRateLimit(), r.handler)
		} else {
			handlePermissionRoute(admin, r.method, r.path, r.permission, r.handler)
		}
	}
}
