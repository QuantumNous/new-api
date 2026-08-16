package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// GetAutoPricingStatus reports the state of the automatic pricing catalog:
// whether it is loaded, how many models it prices, and how the last sync went.
func GetAutoPricingStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    service.GetAutoPricingStatus(),
	})
}

// SyncAutoPricing downloads the catalog immediately, ignoring the stored change
// token so an operator can recover from a bad or stale document without waiting
// for the next scheduled check.
func SyncAutoPricing(c *gin.Context) {
	if err := service.SyncAutoPricingOnce(c.Request.Context(), true); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
			"data":    service.GetAutoPricingStatus(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    service.GetAutoPricingStatus(),
	})
}
