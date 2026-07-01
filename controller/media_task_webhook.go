package controller

import (
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func MediaTaskCallback(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "message": "failed to read body"})
		return
	}
	if err := service.ProcessMediaTaskWebhook(c.Request.Context(), body); err != nil {
		logger.LogWarn(c.Request.Context(), "media task webhook ignored: "+err.Error())
		if strings.Contains(err.Error(), "invalid media task webhook payload") ||
			strings.Contains(err.Error(), "missing media task webhook id") {
			c.JSON(http.StatusBadRequest, gin.H{"ok": false})
			return
		}
		c.JSON(http.StatusServiceUnavailable, gin.H{"ok": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
