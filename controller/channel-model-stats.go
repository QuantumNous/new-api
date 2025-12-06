package controller

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetChannelModelStats 获取渠道+模型详细统计
// GET /api/channel/stats/model-detail
func GetChannelModelStats(c *gin.Context) {
	query := parseChannelModelStatsQuery(c)

	stats, err := model.GetChannelModelStats(query)
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

// GetChannelModelSummary 获取渠道模型汇总统计
// GET /api/channel/stats/model-summary
func GetChannelModelSummary(c *gin.Context) {
	query := parseChannelModelStatsQuery(c)

	summary, err := model.GetChannelModelSummary(query)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    summary,
	})
}

// GetAvailableModels 获取可用模型列表(用于筛选器)
// GET /api/channel/stats/models
func GetAvailableModels(c *gin.Context) {
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

	// 获取用户ID用于权限过滤
	userId := 0
	if !isAdminRequest(c) {
		userId = c.GetInt("id")
	}

	models, err := model.GetDistinctModels(channelIds, startTimestamp, endTimestamp, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    models,
	})
}

// ExportChannelModelStats 导出渠道模型统计数据
// GET /api/channel/stats/model-export
func ExportChannelModelStats(c *gin.Context) {
	query := parseChannelModelStatsQuery(c)
	format := c.DefaultQuery("format", "csv")

	// 移除分页限制，获取所有数据
	query.Page = 1
	query.PageSize = 10000 // 最多导出10000条

	stats, err := model.GetChannelModelStats(query)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if format == "csv" {
		exportChannelModelStatsCSV(c, stats.Data)
	} else {
		// 返回JSON格式
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    stats.Data,
		})
	}
}

// exportChannelModelStatsCSV 导出CSV格式
func exportChannelModelStatsCSV(c *gin.Context, stats []model.ChannelModelStat) {
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=channel_model_stats_%s.csv", time.Now().Format("20060102_150405")))
	// UTF-8 BOM
	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// 写入表头
	header := []string{
		"渠道ID",
		"渠道名称",
		"模型名称",
		"时间点",
		"总调用次数",
		"成功次数",
		"失败次数",
		"成功率(%)",
		"输入Token总量",
		"输出Token总量",
		"平均输入Token",
		"平均输出Token",
		"平均响应时间(s)",
		"最小响应时间(s)",
		"最大响应时间(s)",
		"P50响应时间(s)",
		"P90响应时间(s)",
		"P95响应时间(s)",
		"P99响应时间(s)",
		"总消耗额度",
	}
	writer.Write(header)

	// 写入数据
	for _, stat := range stats {
		record := []string{
			strconv.Itoa(stat.ChannelId),
			stat.ChannelName,
			stat.ModelName,
			stat.TimePoint,
			strconv.FormatInt(stat.TotalCalls, 10),
			strconv.FormatInt(stat.SuccessCalls, 10),
			strconv.FormatInt(stat.FailedCalls, 10),
			fmt.Sprintf("%.2f", stat.SuccessRate),
			strconv.FormatInt(stat.PromptTokens, 10),
			strconv.FormatInt(stat.CompletionTokens, 10),
			fmt.Sprintf("%.2f", stat.AvgPromptTokens),
			fmt.Sprintf("%.2f", stat.AvgCompletionTokens),
			fmt.Sprintf("%.2f", stat.AvgResponseTime),
			fmt.Sprintf("%.2f", stat.MinResponseTime),
			fmt.Sprintf("%.2f", stat.MaxResponseTime),
			fmt.Sprintf("%.2f", stat.P50ResponseTime),
			fmt.Sprintf("%.2f", stat.P90ResponseTime),
			fmt.Sprintf("%.2f", stat.P95ResponseTime),
			fmt.Sprintf("%.2f", stat.P99ResponseTime),
			strconv.FormatInt(stat.TotalQuota, 10),
		}
		writer.Write(record)
	}
}

// parseChannelModelStatsQuery 解析查询参数
func parseChannelModelStatsQuery(c *gin.Context) model.ChannelModelStatsQuery {
	query := model.ChannelModelStatsQuery{}

	// 解析渠道ID
	channelIdsStr := c.Query("channel_ids")
	if channelIdsStr != "" {
		idStrs := strings.Split(channelIdsStr, ",")
		for _, idStr := range idStrs {
			if id, err := strconv.Atoi(strings.TrimSpace(idStr)); err == nil {
				query.ChannelIds = append(query.ChannelIds, id)
			}
		}
	}

	// 解析模型名称
	modelNamesStr := c.Query("model_names")
	if modelNamesStr != "" {
		names := strings.Split(modelNamesStr, ",")
		for _, name := range names {
			trimmed := strings.TrimSpace(name)
			if trimmed != "" {
				query.ModelNames = append(query.ModelNames, trimmed)
			}
		}
	}

	// 解析时间范围
	query.StartTime, _ = strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	query.EndTime, _ = strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	// 解析时间粒度
	query.Granularity = c.DefaultQuery("granularity", "none")

	// 解析排序
	query.SortBy = c.DefaultQuery("sort_by", "total_calls")
	query.SortOrder = c.DefaultQuery("sort_order", "desc")

	// 解析分页
	query.Page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	query.PageSize, _ = strconv.Atoi(c.DefaultQuery("page_size", "20"))

	// 用户权限过滤
	if !isAdminRequest(c) {
		query.UserId = c.GetInt("id")
	}

	return query
}

// isAdminRequest 检查是否是管理员请求
func isAdminRequest(c *gin.Context) bool {
	role := c.GetInt("role")
	return role >= common.RoleAdminUser
}

// GetChannelModelPercentiles 获取特定渠道模型的百分位响应时间
// GET /api/channel/stats/model-percentiles
func GetChannelModelPercentiles(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Query("channel_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "channel_id is required",
		})
		return
	}

	modelName := c.Query("model_name")
	if modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "model_name is required",
		})
		return
	}

	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	// 用户权限过滤
	userId := 0
	if !isAdminRequest(c) {
		userId = c.GetInt("id")
	}

	percentiles, err := model.GetPercentileResponseTime(channelId, modelName, startTimestamp, endTimestamp, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"channel_id": channelId,
			"model_name": modelName,
			"p50":        percentiles.P50,
			"p90":        percentiles.P90,
			"p95":        percentiles.P95,
			"p99":        percentiles.P99,
		},
	})
}

// GetTokenRangeStats 获取Token范围统计
// GET /api/channel/stats/token-range
func GetTokenRangeStats(c *gin.Context) {
	query := parseChannelModelStatsQuery(c)
	tokenType := c.DefaultQuery("token_type", "prompt") // prompt or completion

	if tokenType != "prompt" && tokenType != "completion" {
		tokenType = "prompt"
	}

	stats, err := model.GetTokenRangeStats(query, tokenType)
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

// GetTokenRangeDetailStats 获取Token范围详细统计（按渠道/模型细分）
// GET /api/channel/stats/token-range-detail
func GetTokenRangeDetailStats(c *gin.Context) {
	query := parseChannelModelStatsQuery(c)
	tokenType := c.DefaultQuery("token_type", "prompt")

	if tokenType != "prompt" && tokenType != "completion" {
		tokenType = "prompt"
	}

	stats, err := model.GetTokenRangeDetailStats(query, tokenType)
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

// GetTokenRangeComparison 获取Token范围对比（输入vs输出）
// GET /api/channel/stats/token-range-comparison
func GetTokenRangeComparison(c *gin.Context) {
	query := parseChannelModelStatsQuery(c)

	promptStats, err := model.GetTokenRangeStats(query, "prompt")
	if err != nil {
		common.ApiError(c, err)
		return
	}

	completionStats, err := model.GetTokenRangeStats(query, "completion")
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"prompt":     promptStats,
			"completion": completionStats,
		},
	})
}

// GetChannelModelTrend 获取渠道模型趋势数据(用于图表)
// GET /api/channel/stats/model-trend
func GetChannelModelTrend(c *gin.Context) {
	query := parseChannelModelStatsQuery(c)

	// 强制使用时间粒度
	if query.Granularity == "none" || query.Granularity == "" {
		query.Granularity = "day"
	}

	// 获取全部数据用于趋势图
	query.Page = 1
	query.PageSize = 1000

	stats, err := model.GetChannelModelStats(query)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 按时间点、渠道、模型组织数据
	trendData := make(map[string][]model.ChannelModelStat)
	for _, stat := range stats.Data {
		key := stat.TimePoint
		trendData[key] = append(trendData[key], stat)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    trendData,
	})
}

