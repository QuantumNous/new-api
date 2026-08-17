package controller

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/origin"
	"github.com/gin-gonic/gin"
)

type originOpenAIModel struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	OwnedBy string `json:"owned_by"`
}

func ListOriginModels(c *gin.Context) {
	originKey, ok := origin.Credential(c)
	manager := origin.ActiveManager()
	requestID := c.GetString(common.RequestIdKey)
	if !ok || manager == nil || requestID == "" {
		writeOriginModelsError(c, http.StatusServiceUnavailable, "platform_unavailable", "Origin Platform is unavailable")
		return
	}
	result, err := manager.ListModels(c.Request.Context(), originKey, requestID)
	if err != nil {
		var controlError *origin.ControlError
		switch {
		case errors.As(err, &controlError) && controlError.Status == http.StatusUnauthorized:
			writeOriginModelsError(c, http.StatusUnauthorized, "invalid_api_key", "Invalid Origin Key")
		case errors.As(err, &controlError) && controlError.Status == http.StatusForbidden:
			writeOriginModelsError(c, http.StatusForbidden, "access_denied", "Origin Key is not authorized")
		default:
			writeOriginModelsError(c, http.StatusServiceUnavailable, "platform_unavailable", "Origin Platform is unavailable")
		}
		return
	}
	models := make([]originOpenAIModel, len(result.Models))
	for index, model := range result.Models {
		models[index] = originOpenAIModel{ID: model, Object: "model", OwnedBy: "origin"}
	}
	c.JSON(http.StatusOK, gin.H{"object": "list", "data": models})
}

func writeOriginModelsError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": gin.H{
		"message": common.MessageWithRequestId(message, c.GetString(common.RequestIdKey)),
		"type":    "new_api_error",
		"code":    code,
	}})
	c.Abort()
	logger.LogError(c.Request.Context(), "Origin model discovery failed: "+code)
}
