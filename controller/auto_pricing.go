package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

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

// GetAutoPricingPending returns the current immutable review queue. Each item
// carries the fingerprint of the exact candidate structure being reviewed.
func GetAutoPricingPending(c *gin.Context) {
	pending, revision := service.GetAutoPricingPendingWithRevision()
	c.Header("ETag", `"`+revision+`"`)
	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"revision": revision,
		"data":     pending,
	})
}

type autoPricingReviewRequest struct {
	Models       []string `json:"models"`
	Fingerprints []string `json:"fingerprints"`
	Action       string   `json:"action"`
}

// ReviewAutoPricing atomically approves or rejects only items in the current
// pending queue. Stale and duplicate candidate fingerprints are rejected.
func ReviewAutoPricing(c *gin.Context) {
	var request autoPricingReviewRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": fmt.Sprintf("invalid review request: %v", err),
		})
		return
	}
	if request.Action != "approve" && request.Action != "reject" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "action must be approve or reject"})
		return
	}
	if len(request.Models) > 0 && len(request.Fingerprints) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "models and fingerprints cannot be submitted together"})
		return
	}
	var err error
	results := make([]service.AutoPricingReviewResult, 0)
	if len(request.Models) > 0 {
		revision := strings.Trim(strings.TrimSpace(c.GetHeader("If-Match")), `"`)
		results, err = service.ReviewAutoPricingByModels(request.Models, request.Action, revision)
	} else {
		err = service.ReviewAutoPricing(request.Fingerprints, request.Action)
	}
	if err != nil {
		status := http.StatusBadRequest
		var reviewErr *service.AutoPricingReviewError
		if errors.As(err, &reviewErr) {
			status = reviewErr.Status
		}
		c.JSON(status, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	pending, revision := service.GetAutoPricingPendingWithRevision()
	c.Header("ETag", `"`+revision+`"`)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"status":   service.GetAutoPricingStatus(),
			"pending":  pending,
			"revision": revision,
			"results":  results,
		},
	})
}
