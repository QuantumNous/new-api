package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetRealtimeUsers returns a bounded realtime usage snapshot for administrators.
func GetRealtimeUsers(c *gin.Context) {
	params := model.RealtimeUsageParams{}
	if value := c.Query("window_seconds"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid window_seconds"})
			return
		}
		params.WindowSeconds = parsed
	}
	if value := c.Query("trend_minutes"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid trend_minutes"})
			return
		}
		params.TrendMinutes = parsed
	}
	if value := c.Query("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid limit"})
			return
		}
		params.Limit = parsed
	}
	if _, err := model.NormalizeRealtimeUsageParams(params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	snapshot, err := model.GetRealtimeUsageSnapshot(params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": snapshot})
}
