package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func SetYkSdRouter(router *gin.Engine) {
	g := router.Group("/api/yk-sd")
	g.Use(middleware.RouteTag("api"))
	g.Use(middleware.TokenAuth())
	{
		g.POST("/assets/upload", controller.YkSdAssetUpload)
		g.POST("/assets/detail", controller.YkSdAssetDetail)
	}
}
