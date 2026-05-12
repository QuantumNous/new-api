package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func isRankingsEnabled() bool {
	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap["HeaderNavModules"]
	common.OptionMapRWMutex.RUnlock()

	if raw == "" {
		return true
	}

	var parsed map[string]interface{}
	if err := common.Unmarshal([]byte(raw), &parsed); err != nil {
		return true
	}
	rankings, ok := parsed["rankings"]
	if !ok {
		return true
	}
	switch v := rankings.(type) {
	case bool:
		return v
	case map[string]interface{}:
		if enabled, ok := v["enabled"]; ok {
			if b, ok := enabled.(bool); ok {
				return b
			}
		}
		return true
	}
	return true
}

func GetRankings(c *gin.Context) {
	if !isRankingsEnabled() {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "rankings is disabled",
		})
		return
	}

	result, err := service.GetRankingsSnapshot(c.DefaultQuery("period", "week"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}
