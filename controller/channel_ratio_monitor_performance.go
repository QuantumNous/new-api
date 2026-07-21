package controller

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

const defaultChannelMonitorPerformanceMinutes = 15

func getChannelMonitorPerformanceMinutes(c *gin.Context) (int, bool) {
	minutes := defaultChannelMonitorPerformanceMinutes
	if rawMinutes := c.Query("minutes"); rawMinutes != "" {
		parsedMinutes, err := strconv.Atoi(rawMinutes)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "性能统计时间范围无效"})
			return 0, false
		}
		minutes = parsedMinutes
	}
	switch minutes {
	case 15, 60, 360, 1440:
	default:
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "性能统计仅支持 15 分钟、1 小时、6 小时或 24 小时"})
		return 0, false
	}
	return minutes, true
}

func GetChannelMonitorPerformance(c *gin.Context) {
	minutes, ok := getChannelMonitorPerformanceMinutes(c)
	if !ok {
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
	successMetricsAvailable := common.LogConsumeEnabled && constant.ErrorLogEnabled
	successMetrics := make([]model.ChannelMonitorSuccessMetric, 0)
	groupSuccessMetrics := make([]model.ChannelMonitorGroupSuccessMetric, 0)
	if successMetricsAvailable {
		successMetrics, groupSuccessMetrics, err = model.GetChannelMonitorSuccessMetrics(
			c.Request.Context(),
			generatedAt-int64(minutes*60),
		)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}
	common.ApiSuccess(c, gin.H{
		"range_minutes":             minutes,
		"generated_at":              generatedAt,
		"items":                     metrics,
		"success_metrics_available": successMetricsAvailable,
		"success_items":             successMetrics,
		"group_success_items":       groupSuccessMetrics,
	})
}

func GetChannelMonitorSuccessDetail(c *gin.Context) {
	minutes, ok := getChannelMonitorPerformanceMinutes(c)
	if !ok {
		return
	}

	generatedAt := time.Now().Unix()
	successMetricsAvailable := common.LogConsumeEnabled && constant.ErrorLogEnabled
	if !successMetricsAvailable {
		common.ApiSuccess(c, gin.H{
			"range_minutes":             minutes,
			"generated_at":              generatedAt,
			"success_metrics_available": false,
			"scope":                     "",
			"detail": model.ChannelMonitorSuccessDetail{
				ChannelItems:      make([]model.ChannelMonitorChannelSuccessMetric, 0),
				FailureCategories: make([]model.ChannelMonitorFailureCategory, 0),
			},
		})
		return
	}

	rawChannelId := strings.TrimSpace(c.Query("channel_id"))
	group := strings.TrimSpace(c.Query("group"))
	if (rawChannelId == "" && group == "") || (rawChannelId != "" && group != "") {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "成功率明细必须指定一个渠道或分组"})
		return
	}

	filter := model.ChannelMonitorSuccessFilter{}
	scope := "group"
	if rawChannelId != "" {
		channelId, err := strconv.Atoi(rawChannelId)
		if err != nil || channelId <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "渠道 ID 无效"})
			return
		}
		filter.ChannelId = channelId
		filter.ModelName = strings.TrimSpace(c.Query("model_name"))
		scope = "channel"
	} else {
		filter.Group = group
	}

	detail, err := model.GetChannelMonitorSuccessDetail(
		c.Request.Context(),
		generatedAt-int64(minutes*60),
		filter,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"range_minutes":             minutes,
		"generated_at":              generatedAt,
		"success_metrics_available": true,
		"scope":                     scope,
		"detail":                    detail,
	})
}
