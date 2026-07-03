package controller

import (
	"errors"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func SyncAistarsLabConfig(c *gin.Context) {
	var req service.AistarsLabSyncRequest
	if c.Request.Body != nil {
		err := common.DecodeJson(c.Request.Body, &req)
		if err != nil && !errors.Is(err, io.EOF) {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "无效的参数",
			})
			return
		}
	}
	result, err := service.SyncAistarsLabConfig(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    result,
	})
}
