package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// GetLogBody serves a body file that was offloaded to disk by
// common.StoreBodyOrInline. The path is expected to be a relative path
// like "20060102/req_abc123_request_body.json".
func GetLogBody(c *gin.Context) {
	relPath := c.Param("path")
	if relPath == "" || strings.Contains(relPath, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid path"})
		return
	}

	data, err := common.ReadBodyFile(relPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read body file"})
		return
	}
	if data == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "body file not found"})
		return
	}

	c.Data(http.StatusOK, "application/json; charset=utf-8", data)
}
