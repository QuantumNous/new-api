package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func ListDataTools(c *gin.Context) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		common.ApiErrorMsg(c, "page must be a positive integer")
		return
	}
	pageSize, err := strconv.Atoi(c.DefaultQuery("page_size", "24"))
	if err != nil || pageSize < 1 || pageSize > 200 {
		common.ApiErrorMsg(c, "page_size must be between 1 and 200")
		return
	}

	result, err := service.ListDataTools(
		c.Request.Context(),
		strings.TrimSpace(c.Query("q")),
		strings.TrimSpace(c.Query("platform")),
		page,
		pageSize,
		strings.TrimSpace(c.Query("cursor")),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func InspectDataTool(c *gin.Context) {
	toolID := strings.TrimSpace(c.Query("id"))
	if toolID == "" {
		common.ApiErrorMsg(c, "tool id is required")
		return
	}
	result, err := service.InspectDataTool(c.Request.Context(), toolID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

type runDataToolRequest struct {
	ID    string         `json:"id"`
	Input map[string]any `json:"input"`
}

func RunDataTool(c *gin.Context) {
	if c.GetInt("token_id") <= 0 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "a Flatkey API key is required to run data tools",
		})
		return
	}
	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Idempotency-Key header is required",
		})
		return
	}

	var request runDataToolRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	request.ID = strings.TrimSpace(request.ID)
	if request.ID == "" {
		common.ApiErrorMsg(c, "tool id is required")
		return
	}

	result, err := service.ExecuteDataTool(
		c.Request.Context(),
		service.DataToolBillingContext{
			UserID:         c.GetInt("id"),
			TokenID:        c.GetInt("token_id"),
			TokenKey:       c.GetString("token_key"),
			TokenUnlimited: c.GetBool("token_unlimited_quota"),
		},
		idempotencyKey,
		request.ID,
		request.Input,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}
