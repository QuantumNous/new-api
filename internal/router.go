package internal

import (
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes mounts the internal-key admin routes and the routes that are
// protected by the internal key auth. Future endpoints meant for internal
// system calls should be added to the internalRoutes group below.
func RegisterRoutes(api *gin.RouterGroup) {
	internalKeyRoutes := api.Group("/internal_key")
	internalKeyRoutes.Use(middleware.RootAuth())
	{
		internalKeyRoutes.GET("/", getAllInternalKeys)
		internalKeyRoutes.POST("/", addInternalKey)
		internalKeyRoutes.PUT("/", updateInternalKey)
		internalKeyRoutes.DELETE("/:id", deleteInternalKey)
	}

	// 内部系统调用入口，通过 X-Key-Id / X-Key 请求头鉴权。
	internalRoutes := api.Group("/internal")
	internalRoutes.Use(InternalAuth())
	{
		internalRoutes.GET("/ping", internalAuthCheck)
	}
}
