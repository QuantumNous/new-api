package model

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// getTimeFormatSQL 根据数据库类型返回时间格式化SQL
func getTimeFormatSQL(granularity string) string {
	if common.UsingPostgreSQL {
		// PostgreSQL 语法
		switch granularity {
		case "hour":
			return "TO_CHAR(TO_TIMESTAMP(logs.created_at), 'YYYY-MM-DD HH24:00:00')"
		case "day":
			return "TO_CHAR(TO_TIMESTAMP(logs.created_at), 'YYYY-MM-DD')"
		case "week":
			return "TO_CHAR(TO_TIMESTAMP(logs.created_at), 'IYYY-IW')"
		default:
			return "TO_CHAR(TO_TIMESTAMP(logs.created_at), 'YYYY-MM-DD')"
		}
	} else if common.UsingSQLite {
		// SQLite 语法 - 使用 strftime
		switch granularity {
		case "hour":
			return "strftime('%Y-%m-%d %H:00:00', logs.created_at, 'unixepoch')"
		case "day":
			return "strftime('%Y-%m-%d', logs.created_at, 'unixepoch')"
		case "week":
			return "strftime('%Y-%W', logs.created_at, 'unixepoch')"
		default:
			return "strftime('%Y-%m-%d', logs.created_at, 'unixepoch')"
		}
	} else {
		// MySQL 语法
		switch granularity {
		case "hour":
			return "FROM_UNIXTIME(logs.created_at, '%Y-%m-%d %H:00:00')"
		case "day":
			return "FROM_UNIXTIME(logs.created_at, '%Y-%m-%d')"
		case "week":
			return "DATE_FORMAT(FROM_UNIXTIME(logs.created_at), '%Y-%u')"
		default:
			return "FROM_UNIXTIME(logs.created_at, '%Y-%m-%d')"
		}
	}
}

// getJSONExtractSQL 根据数据库类型返回JSON提取SQL
func getJSONExtractSQL(field string, path string) string {
	if common.UsingPostgreSQL {
		// PostgreSQL 语法: field::jsonb->>'key'
		// path 格式为 '$.key'，需要转换
		key := path[2:] // 去掉 '$.''
		return fmt.Sprintf("%s::jsonb->>'%s'", field, key)
	} else {
		// MySQL 语法
		return fmt.Sprintf("JSON_EXTRACT(%s, '%s')", field, path)
	}
}

// ChannelPerformanceStat 渠道性能统计
type ChannelPerformanceStat struct {
	ChannelId       int     `json:"channel_id"`
	ChannelName     string  `json:"channel_name"`
	ChannelType     int     `json:"channel_type"`
	TotalCalls      int64   `json:"total_calls"`
	SuccessCalls    int64   `json:"success_calls"`
	FailedCalls     int64   `json:"failed_calls"`
	SuccessRate     float64 `json:"success_rate"`
	AvgResponseTime float64 `json:"avg_response_time"` // 平均响应时间（秒）
	MinResponseTime float64 `json:"min_response_time"` // 最小响应时间（秒）
	MaxResponseTime float64 `json:"max_response_time"` // 最大响应时间（秒）
	TotalQuota      int64   `json:"total_quota"`       // 总消耗额度
	TotalTokens     int64   `json:"total_tokens"`      // 总token数
}

// ChannelUsageStat 渠道使用量统计
type ChannelUsageStat struct {
	ChannelId    int     `json:"channel_id"`
	ChannelName  string  `json:"channel_name"`
	TimePoint    string  `json:"time_point"`    // 时间点
	CallCount    int64   `json:"call_count"`    // 调用次数
	QuotaUsed    int64   `json:"quota_used"`    // 消耗额度
	TokensUsed   int64   `json:"tokens_used"`   // 使用token数
	AvgUseTime   float64 `json:"avg_use_time"`  // 平均用时（秒）
	SuccessCount int64   `json:"success_count"` // 成功次数
	FailedCount  int64   `json:"failed_count"`  // 失败次数
}

// ChannelHealthScore 渠道健康度评分
type ChannelHealthScore struct {
	ChannelId        int     `json:"channel_id"`
	ChannelName      string  `json:"channel_name"`
	ChannelType      int     `json:"channel_type"`
	HealthScore      float64 `json:"health_score"`       // 综合健康度评分 (0-100)
	AvailabilityRate float64 `json:"availability_rate"`  // 可用率
	SuccessRate      float64 `json:"success_rate"`       // 成功率
	ResponseScore    float64 `json:"response_score"`     // 响应时间评分
	AvgResponseTime  float64 `json:"avg_response_time"`  // 平均响应时间
	Status           int     `json:"status"`             // 渠道状态
	LastCallTime     int64   `json:"last_call_time"`     // 最后调用时间
}

// ChannelErrorStat 渠道错误统计
type ChannelErrorStat struct {
	ChannelId   int    `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	ErrorType   string `json:"error_type"`   // 错误类型
	ErrorCount  int64  `json:"error_count"`  // 错误次数
	ErrorRate   float64 `json:"error_rate"`  // 错误率
	TimePoint   string `json:"time_point"`   // 时间点（用于趋势分析）
}

// ChannelRealtimeMetric 渠道实时指标
type ChannelRealtimeMetric struct {
	ChannelId       int     `json:"channel_id"`
	ChannelName     string  `json:"channel_name"`
	CurrentRPM      int64   `json:"current_rpm"`        // 当前每分钟请求数
	CurrentTPM      int64   `json:"current_tpm"`        // 当前每分钟token数
	RecentSuccessRate float64 `json:"recent_success_rate"` // 最近成功率
	RecentAvgTime   float64 `json:"recent_avg_time"`    // 最近平均响应时间
	Status          int     `json:"status"`             // 当前状态
	LastUpdateTime  int64   `json:"last_update_time"`   // 最后更新时间
}

// GetChannelPerformanceStats 获取渠道性能统计
func GetChannelPerformanceStats(channelIds []int, startTime, endTime int64, userId int) ([]ChannelPerformanceStat, error) {
	var stats []ChannelPerformanceStat

	query := LOG_DB.Table("logs").
		Select(`
			logs.channel_id,
			COALESCE(channels.name, 'Unknown') as channel_name,
			COALESCE(channels.type, 0) as channel_type,
			COUNT(*) as total_calls,
			SUM(CASE WHEN logs.type = 2 THEN 1 ELSE 0 END) as success_calls,
			SUM(CASE WHEN logs.type = 5 THEN 1 ELSE 0 END) as failed_calls,
			ROUND(SUM(CASE WHEN logs.type = 2 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate,
			ROUND(AVG(CASE WHEN logs.type = 2 THEN logs.use_time ELSE NULL END), 2) as avg_response_time,
			MIN(CASE WHEN logs.type = 2 THEN logs.use_time ELSE NULL END) as min_response_time,
			MAX(CASE WHEN logs.type = 2 THEN logs.use_time ELSE NULL END) as max_response_time,
			SUM(logs.quota) as total_quota,
			SUM(logs.prompt_tokens + logs.completion_tokens) as total_tokens
		`).
		Joins("LEFT JOIN channels ON logs.channel_id = channels.id").
		Where("logs.channel_id > 0")

	// 时间范围过滤
	if startTime > 0 {
		query = query.Where("logs.created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("logs.created_at <= ?", endTime)
	}

	// 渠道ID过滤
	if len(channelIds) > 0 {
		query = query.Where("logs.channel_id IN ?", channelIds)
	}

	// 用户权限过滤（非管理员只能看自己的数据）
	if userId > 0 {
		query = query.Where("logs.user_id = ?", userId)
	}

	query = query.Group("logs.channel_id, channels.name, channels.type").
		Having("COUNT(*) > 0")

	err := query.Scan(&stats).Error
	return stats, err
}

// GetChannelUsageStats 获取渠道使用量统计（按时间粒度）
func GetChannelUsageStats(channelIds []int, startTime, endTime int64, granularity string, userId int) ([]ChannelUsageStat, error) {
	var stats []ChannelUsageStat

	// 根据数据库类型和粒度确定时间格式
	timeFormat := getTimeFormatSQL(granularity)

	query := LOG_DB.Table("logs").
		Select(fmt.Sprintf(`
			logs.channel_id,
			COALESCE(channels.name, 'Unknown') as channel_name,
			%s as time_point,
			COUNT(*) as call_count,
			SUM(logs.quota) as quota_used,
			SUM(logs.prompt_tokens + logs.completion_tokens) as tokens_used,
			AVG(logs.use_time) as avg_use_time,
			SUM(CASE WHEN logs.type = 2 THEN 1 ELSE 0 END) as success_count,
			SUM(CASE WHEN logs.type = 5 THEN 1 ELSE 0 END) as failed_count
		`, timeFormat)).
		Joins("LEFT JOIN channels ON logs.channel_id = channels.id").
		Where("logs.channel_id > 0")

	if startTime > 0 {
		query = query.Where("logs.created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("logs.created_at <= ?", endTime)
	}
	if len(channelIds) > 0 {
		query = query.Where("logs.channel_id IN ?", channelIds)
	}
	if userId > 0 {
		query = query.Where("logs.user_id = ?", userId)
	}

	query = query.Group("logs.channel_id, channels.name, time_point").
		Order("time_point ASC")

	err := query.Scan(&stats).Error
	return stats, err
}

// GetChannelHealthScores 获取渠道健康度评分
func GetChannelHealthScores(channelIds []int, startTime, endTime int64, userId int) ([]ChannelHealthScore, error) {
	var scores []ChannelHealthScore

	// 首先获取基础性能数据
	perfStats, err := GetChannelPerformanceStats(channelIds, startTime, endTime, userId)
	if err != nil {
		return nil, err
	}

	for _, stat := range perfStats {
		score := ChannelHealthScore{
			ChannelId:        stat.ChannelId,
			ChannelName:      stat.ChannelName,
			ChannelType:      stat.ChannelType,
			SuccessRate:      stat.SuccessRate,
			AvgResponseTime:  stat.AvgResponseTime,
		}

		// 获取渠道状态和最后调用时间
		var channel Channel
		if err := DB.Select("status").Where("id = ?", stat.ChannelId).First(&channel).Error; err == nil {
			score.Status = channel.Status
		}

		// 获取最后调用时间
		var lastLog Log
		if err := LOG_DB.Where("channel_id = ? AND type = 2", stat.ChannelId).
			Order("created_at DESC").
			First(&lastLog).Error; err == nil {
			score.LastCallTime = lastLog.CreatedAt
		}

		// 计算可用率（基于渠道状态）
		if score.Status == 1 {
			score.AvailabilityRate = 100.0
		} else {
			score.AvailabilityRate = 0.0
		}

		// 计算响应时间评分（响应时间越短分数越高）
		// 假设理想响应时间为1秒，超过10秒评分为0
		if stat.AvgResponseTime <= 1.0 {
			score.ResponseScore = 100.0
		} else if stat.AvgResponseTime >= 10.0 {
			score.ResponseScore = 0.0
		} else {
			score.ResponseScore = 100.0 - (stat.AvgResponseTime-1.0)*100.0/9.0
		}

		// 计算综合健康度评分
		// 权重：成功率40%，可用率30%，响应时间30%
		score.HealthScore = (score.SuccessRate*0.4 + score.AvailabilityRate*0.3 + score.ResponseScore*0.3)
		score.HealthScore = float64(int(score.HealthScore*100)) / 100 // 保留两位小数

		scores = append(scores, score)
	}

	return scores, nil
}

// GetChannelRealtimeMetrics 获取渠道实时指标
func GetChannelRealtimeMetrics(channelIds []int, userId int) ([]ChannelRealtimeMetric, error) {
	var metrics []ChannelRealtimeMetric

	now := time.Now().Unix()
	oneHourAgo := now - 3600
	oneMinuteAgo := now - 60

	// 获取最近1小时的统计
	query := LOG_DB.Table("logs").
		Select(`
			logs.channel_id,
			COALESCE(channels.name, 'Unknown') as channel_name,
			SUM(CASE WHEN logs.created_at >= ? THEN 1 ELSE 0 END) as current_rpm,
			SUM(CASE WHEN logs.created_at >= ? THEN logs.prompt_tokens + logs.completion_tokens ELSE 0 END) as current_tpm,
			ROUND(SUM(CASE WHEN logs.type = 2 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as recent_success_rate,
			ROUND(AVG(CASE WHEN logs.type = 2 THEN logs.use_time ELSE NULL END), 2) as recent_avg_time,
			COALESCE(channels.status, 0) as status
		`, oneMinuteAgo, oneMinuteAgo).
		Joins("LEFT JOIN channels ON logs.channel_id = channels.id").
		Where("logs.channel_id > 0").
		Where("logs.created_at >= ?", oneHourAgo)

	if len(channelIds) > 0 {
		query = query.Where("logs.channel_id IN ?", channelIds)
	}
	if userId > 0 {
		query = query.Where("logs.user_id = ?", userId)
	}

	query = query.Group("logs.channel_id, channels.name, channels.status")

	err := query.Scan(&metrics).Error
	if err != nil {
		return nil, err
	}

	// 设置最后更新时间
	for i := range metrics {
		metrics[i].LastUpdateTime = now
	}

	return metrics, nil
}

// GetChannelErrorAnalysis 获取渠道错误分析
func GetChannelErrorAnalysis(channelIds []int, startTime, endTime int64, granularity string, userId int) ([]ChannelErrorStat, error) {
	var errorStats []ChannelErrorStat

	// 根据数据库类型和粒度确定时间格式
	timeFormat := getTimeFormatSQL(granularity)
	jsonExtract := getJSONExtractSQL("logs.other", "$.error_type")

	query := LOG_DB.Table("logs").
		Select(fmt.Sprintf(`
			logs.channel_id,
			COALESCE(channels.name, 'Unknown') as channel_name,
			COALESCE(%s, 'Unknown') as error_type,
			COUNT(*) as error_count,
			%s as time_point
		`, jsonExtract, timeFormat)).
		Joins("LEFT JOIN channels ON logs.channel_id = channels.id").
		Where("logs.type = 5"). // 只统计错误日志
		Where("logs.channel_id > 0")

	if startTime > 0 {
		query = query.Where("logs.created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("logs.created_at <= ?", endTime)
	}
	if len(channelIds) > 0 {
		query = query.Where("logs.channel_id IN ?", channelIds)
	}
	if userId > 0 {
		query = query.Where("logs.user_id = ?", userId)
	}

	query = query.Group("logs.channel_id, channels.name, error_type, time_point").
		Order("time_point ASC, error_count DESC")

	err := query.Scan(&errorStats).Error
	if err != nil {
		return nil, err
	}

	// 计算错误率（需要获取总调用次数）
	if len(errorStats) > 0 {
		for i := range errorStats {
			var totalCalls int64
			LOG_DB.Table("logs").
				Where("channel_id = ?", errorStats[i].ChannelId).
				Where("created_at >= ? AND created_at <= ?", startTime, endTime).
				Count(&totalCalls)
			if totalCalls > 0 {
				errorStats[i].ErrorRate = float64(errorStats[i].ErrorCount) * 100.0 / float64(totalCalls)
				errorStats[i].ErrorRate = float64(int(errorStats[i].ErrorRate*100)) / 100
			}
		}
	}

	return errorStats, nil
}

// GetUserChannelIds 获取用户使用过的渠道ID列表
func GetUserChannelIds(userId int, startTime, endTime int64) ([]int, error) {
	var channelIds []int

	query := LOG_DB.Table("logs").
		Select("DISTINCT channel_id").
		Where("user_id = ?", userId).
		Where("channel_id > 0")

	if startTime > 0 {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("created_at <= ?", endTime)
	}

	err := query.Pluck("channel_id", &channelIds).Error
	return channelIds, err
}

