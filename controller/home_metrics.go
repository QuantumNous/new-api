package controller

import (
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetHomeRequestMetrics exposes aggregate-only request telemetry for the
// public landing page. No identity or model-level data leaves this endpoint.
func GetHomeRequestMetrics(c *gin.Context) {
	metrics, err := model.GetHomeRequestMetrics(time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "home request metrics unavailable",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    metrics,
	})
}
