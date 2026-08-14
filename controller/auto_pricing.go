package controller

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/model"
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

	// Pricing page output embeds the resolved ratios, so it has to be rebuilt
	// against the new catalog instead of serving the previous snapshot.
	model.InvalidatePricingCache()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    service.GetAutoPricingStatus(),
	})
}

// GetAutoPricingPending returns the current immutable review queue. Each item
// carries the fingerprint of the exact candidate structure being reviewed.
func GetAutoPricingPending(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    service.GetAutoPricingPending(),
	})
}

type autoPricingReviewRequest struct {
	Models []string `json:"models" binding:"required,min=1"`
	Action string   `json:"action" binding:"required,oneof=approve reject"`
}

// ReviewAutoPricing atomically approves or rejects only items in the current
// pending queue. Stale and duplicate model names are rejected by the service.
func ReviewAutoPricing(c *gin.Context) {
	var request autoPricingReviewRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": fmt.Sprintf("invalid review request: %v", err),
		})
		return
	}
	if err := service.ReviewAutoPricing(request.Models, request.Action); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"status":  service.GetAutoPricingStatus(),
			"pending": service.GetAutoPricingPending(),
		},
	})
}
