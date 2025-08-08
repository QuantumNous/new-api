package router

import (
	"net/http"
	"one-api/common"

	"github.com/gin-gonic/gin"
)

func SetControllerRouter(router *gin.Engine) {

	router.GET("/traffic-stats", func(c *gin.Context) {
		stats := common.GetTrafficStats()
		c.JSON(http.StatusOK, gin.H{
			"traffic_stats": stats,
			"timestamp":     common.GetTimestamp(),
		})
	})

}
