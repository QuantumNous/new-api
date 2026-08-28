package router

import (
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func SetMetricsRouter(router *gin.Engine) {
	router.GET("/metrics", gin.WrapH(service.NewChannelStateMetricsHandler()))
}
