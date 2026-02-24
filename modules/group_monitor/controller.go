package group_monitor

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

// GetGroupMonitorLogs 分页查询监控日志（管理员）
func GetGroupMonitorLogsHandler(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	groupName := c.Query("group")
	startTs, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTs, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	logs, total, err := GetGroupMonitorLogs(groupName, startTs, endTs, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
}

// GetGroupMonitorLatestHandler 获取所有分组最新状态（管理员）
func GetGroupMonitorLatestHandler(c *gin.Context) {
	logs, err := GetGroupMonitorLatest()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, logs)
}

// GetGroupMonitorStatsHandler 获取聚合统计（管理员）
func GetGroupMonitorStatsHandler(c *gin.Context) {
	startTs, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTs, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	// 默认查询最近 1 小时
	if startTs == 0 {
		startTs = common.GetTimestamp() - 3600
	}

	stats, err := GetGroupMonitorStats(startTs, endTs)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, stats)
}

// GetGroupMonitorTimeSeriesHandler 获取时间序列数据（趋势图）
func GetGroupMonitorTimeSeriesHandler(c *gin.Context) {
	groupName := c.Query("group")
	startTs, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTs, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	// 默认最近 1 小时
	if startTs == 0 {
		startTs = common.GetTimestamp() - 3600
	}

	logs, err := GetGroupMonitorTimeSeries(groupName, startTs, endTs)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, logs)
}

// GetGroupMonitorConfigsHandler 获取所有分组监控配置（管理员）
func GetGroupMonitorConfigsHandler(c *gin.Context) {
	configs, err := GetAllGroupMonitorConfigs()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, configs)
}

// SaveGroupMonitorConfigHandler 保存分组监控配置（管理员）
func SaveGroupMonitorConfigHandler(c *gin.Context) {
	var cfg GroupMonitorConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request body",
		})
		return
	}

	if cfg.GroupName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "group_name is required",
		})
		return
	}

	if err := SaveGroupMonitorConfig(&cfg); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// DeleteGroupMonitorConfigHandler 删除分组监控配置（管理员）
func DeleteGroupMonitorConfigHandler(c *gin.Context) {
	groupName := c.Param("group")
	if groupName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "group name is required",
		})
		return
	}

	if err := DeleteGroupMonitorConfig(groupName); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// GetGroupMonitorStatusHandler 用户可见的简化状态
func GetGroupMonitorStatusHandler(c *gin.Context) {
	// 获取最近 1 小时的聚合统计
	startTs := common.GetTimestamp() - 3600
	stats, err := GetGroupMonitorStats(startTs, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 获取每个分组的最新记录
	latest, err := GetGroupMonitorLatest()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	type GroupStatus struct {
		GroupName      string  `json:"group_name"`
		LatestLatency  int64   `json:"latest_latency"`
		LatestSuccess  bool    `json:"latest_success"`
		LatestTime     int64   `json:"latest_time"`
		AvgLatency     float64 `json:"avg_latency"`
		Availability   float64 `json:"availability"` // 百分比
		TotalChecks    int64   `json:"total_checks"`
	}

	// 构建 stats map
	statsMap := make(map[string]*GroupMonitorStat)
	for i := range stats {
		statsMap[stats[i].GroupName] = &stats[i]
	}

	var result []GroupStatus
	for _, log := range latest {
		status := GroupStatus{
			GroupName:     log.GroupName,
			LatestLatency: log.LatencyMs,
			LatestSuccess: log.Success,
			LatestTime:    log.CreatedAt,
		}
		if stat, ok := statsMap[log.GroupName]; ok {
			status.AvgLatency = stat.AvgLatency
			status.TotalChecks = stat.TotalCount
			if stat.TotalCount > 0 {
				status.Availability = float64(stat.SuccessCount) / float64(stat.TotalCount) * 100
			}
		}
		result = append(result, status)
	}
	common.ApiSuccess(c, result)
}
