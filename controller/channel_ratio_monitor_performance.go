package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

const defaultChannelMonitorPerformanceMinutes = 15

func GetChannelMonitorPerformance(c *gin.Context) {
	minutes := defaultChannelMonitorPerformanceMinutes
	if rawMinutes := c.Query("minutes"); rawMinutes != "" {
		parsedMinutes, err := strconv.Atoi(rawMinutes)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "性能统计时间范围无效"})
			return
		}
		minutes = parsedMinutes
	}
	switch minutes {
	case 15, 60, 360, 1440:
	default:
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "性能统计仅支持 15 分钟、1 小时、6 小时或 24 小时"})
		return
	}

	generatedAt := time.Now().Unix()
	metrics, err := model.GetChannelMonitorPerformanceMetrics(
		c.Request.Context(),
		generatedAt-int64(minutes*60),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"range_minutes": minutes,
		"generated_at":  generatedAt,
		"items":         metrics,
	})
}
