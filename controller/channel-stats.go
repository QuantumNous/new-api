package controller

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetChannelPerformanceStats 获取渠道性能统计
// GET /api/channel/stats/performance
func GetChannelPerformanceStats(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	channelIdsStr := c.Query("channel_ids")

	var channelIds []int
	if channelIdsStr != "" {
		idStrs := strings.Split(channelIdsStr, ",")
		for _, idStr := range idStrs {
			if id, err := strconv.Atoi(strings.TrimSpace(idStr)); err == nil {
				channelIds = append(channelIds, id)
			}
		}
	}

	stats, err := model.GetChannelPerformanceStats(channelIds, startTimestamp, endTimestamp, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    stats,
	})
}

// GetChannelUsageStats 获取渠道使用量统计
// GET /api/channel/stats/usage
func GetChannelUsageStats(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	channelIdsStr := c.Query("channel_ids")
	granularity := c.Query("time_granularity")
	if granularity == "" {
		granularity = "day"
	}

	var channelIds []int
	if channelIdsStr != "" {
		idStrs := strings.Split(channelIdsStr, ",")
		for _, idStr := range idStrs {
			if id, err := strconv.Atoi(strings.TrimSpace(idStr)); err == nil {
				channelIds = append(channelIds, id)
			}
		}
	}

	stats, err := model.GetChannelUsageStats(channelIds, startTimestamp, endTimestamp, granularity, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    stats,
	})
}

// GetChannelComparisonData 获取多渠道对比数据
// GET /api/channel/stats/comparison
func GetChannelComparisonData(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	channelIdsStr := c.Query("channel_ids")

	var channelIds []int
	if channelIdsStr != "" {
		idStrs := strings.Split(channelIdsStr, ",")
		for _, idStr := range idStrs {
			if id, err := strconv.Atoi(strings.TrimSpace(idStr)); err == nil {
				channelIds = append(channelIds, id)
			}
		}
	}

	// 获取性能统计作为对比数据
	perfStats, err := model.GetChannelPerformanceStats(channelIds, startTimestamp, endTimestamp, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 获取健康度评分
	healthScores, err := model.GetChannelHealthScores(channelIds, startTimestamp, endTimestamp, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"performance": perfStats,
			"health":      healthScores,
		},
	})
}

// GetChannelTrendData 获取渠道趋势数据
// GET /api/channel/stats/trend
func GetChannelTrendData(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	channelIdsStr := c.Query("channel_ids")
	granularity := c.Query("time_granularity")
	if granularity == "" {
		granularity = "day"
	}

	var channelIds []int
	if channelIdsStr != "" {
		idStrs := strings.Split(channelIdsStr, ",")
		for _, idStr := range idStrs {
			if id, err := strconv.Atoi(strings.TrimSpace(idStr)); err == nil {
				channelIds = append(channelIds, id)
			}
		}
	}

	stats, err := model.GetChannelUsageStats(channelIds, startTimestamp, endTimestamp, granularity, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    stats,
	})
}

// GetChannelHealthScores 获取渠道健康度评分
// GET /api/channel/stats/health
func GetChannelHealthScores(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	channelIdsStr := c.Query("channel_ids")

	var channelIds []int
	if channelIdsStr != "" {
		idStrs := strings.Split(channelIdsStr, ",")
		for _, idStr := range idStrs {
			if id, err := strconv.Atoi(strings.TrimSpace(idStr)); err == nil {
				channelIds = append(channelIds, id)
			}
		}
	}

	scores, err := model.GetChannelHealthScores(channelIds, startTimestamp, endTimestamp, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    scores,
	})
}

// GetChannelRealtimeMetrics 获取渠道实时指标
// GET /api/channel/stats/realtime
func GetChannelRealtimeMetrics(c *gin.Context) {
	channelIdsStr := c.Query("channel_ids")

	var channelIds []int
	if channelIdsStr != "" {
		idStrs := strings.Split(channelIdsStr, ",")
		for _, idStr := range idStrs {
			if id, err := strconv.Atoi(strings.TrimSpace(idStr)); err == nil {
				channelIds = append(channelIds, id)
			}
		}
	}

	metrics, err := model.GetChannelRealtimeMetrics(channelIds, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    metrics,
	})
}

// GetChannelErrorAnalysis 获取渠道错误分析
// GET /api/channel/stats/errors
func GetChannelErrorAnalysis(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	channelIdsStr := c.Query("channel_ids")
	granularity := c.Query("time_granularity")
	if granularity == "" {
		granularity = "day"
	}

	var channelIds []int
	if channelIdsStr != "" {
		idStrs := strings.Split(channelIdsStr, ",")
		for _, idStr := range idStrs {
			if id, err := strconv.Atoi(strings.TrimSpace(idStr)); err == nil {
				channelIds = append(channelIds, id)
			}
		}
	}

	errorStats, err := model.GetChannelErrorAnalysis(channelIds, startTimestamp, endTimestamp, granularity, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    errorStats,
	})
}

// ExportChannelReport 导出渠道报告
// GET /api/channel/stats/export
func ExportChannelReport(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	channelIdsStr := c.Query("channel_ids")
	format := c.Query("format") // csv 或 json
	if format == "" {
		format = "csv"
	}

	var channelIds []int
	if channelIdsStr != "" {
		idStrs := strings.Split(channelIdsStr, ",")
		for _, idStr := range idStrs {
			if id, err := strconv.Atoi(strings.TrimSpace(idStr)); err == nil {
				channelIds = append(channelIds, id)
			}
		}
	}

	stats, err := model.GetChannelPerformanceStats(channelIds, startTimestamp, endTimestamp, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if format == "csv" {
		c.Writer.Header().Set("Content-Type", "text/csv")
		c.Writer.Header().Set("Content-Disposition", "attachment;filename=channel_stats.csv")

		writer := csv.NewWriter(c.Writer)
		defer writer.Flush()

		// 写入CSV头
		headers := []string{
			"Channel ID", "Channel Name", "Channel Type",
			"Total Calls", "Success Calls", "Failed Calls",
			"Success Rate(%)", "Avg Response Time(s)",
			"Min Response Time(s)", "Max Response Time(s)",
			"Total Quota", "Total Tokens",
		}
		writer.Write(headers)

		// 写入数据
		for _, stat := range stats {
			record := []string{
				strconv.Itoa(stat.ChannelId),
				stat.ChannelName,
				strconv.Itoa(stat.ChannelType),
				strconv.FormatInt(stat.TotalCalls, 10),
				strconv.FormatInt(stat.SuccessCalls, 10),
				strconv.FormatInt(stat.FailedCalls, 10),
				fmt.Sprintf("%.2f", stat.SuccessRate),
				fmt.Sprintf("%.2f", stat.AvgResponseTime),
				fmt.Sprintf("%.2f", stat.MinResponseTime),
				fmt.Sprintf("%.2f", stat.MaxResponseTime),
				strconv.FormatInt(stat.TotalQuota, 10),
				strconv.FormatInt(stat.TotalTokens, 10),
			}
			writer.Write(record)
		}
	} else {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    stats,
		})
	}
}

// GetUserChannelStats 获取用户渠道统计（普通用户接口）
// GET /api/channel/stats/self
func GetUserChannelStats(c *gin.Context) {
	userId := c.GetInt("id")
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	statsType := c.Query("type") // performance, usage, health, realtime

	// 获取用户使用过的渠道ID列表
	channelIds, err := model.GetUserChannelIds(userId, startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var data interface{}

	switch statsType {
	case "performance":
		data, err = model.GetChannelPerformanceStats(channelIds, startTimestamp, endTimestamp, userId)
	case "usage":
		granularity := c.Query("time_granularity")
		if granularity == "" {
			granularity = "day"
		}
		data, err = model.GetChannelUsageStats(channelIds, startTimestamp, endTimestamp, granularity, userId)
	case "health":
		data, err = model.GetChannelHealthScores(channelIds, startTimestamp, endTimestamp, userId)
	case "realtime":
		data, err = model.GetChannelRealtimeMetrics(channelIds, userId)
	case "errors":
		granularity := c.Query("time_granularity")
		if granularity == "" {
			granularity = "day"
		}
		data, err = model.GetChannelErrorAnalysis(channelIds, startTimestamp, endTimestamp, granularity, userId)
	default:
		// 默认返回性能统计
		data, err = model.GetChannelPerformanceStats(channelIds, startTimestamp, endTimestamp, userId)
	}

	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    data,
	})
}

