package model

import (
	"fmt"
	"sort"

	"github.com/QuantumNous/new-api/common"
)

// ChannelModelStat 渠道+模型详细统计
type ChannelModelStat struct {
	ChannelId           int     `json:"channel_id"`
	ChannelName         string  `json:"channel_name"`
	ModelName           string  `json:"model_name"`
	TimePoint           string  `json:"time_point"`            // 时间点(按粒度聚合)
	TotalCalls          int64   `json:"total_calls"`           // 总调用次数
	SuccessCalls        int64   `json:"success_calls"`         // 成功次数
	FailedCalls         int64   `json:"failed_calls"`          // 失败次数
	SuccessRate         float64 `json:"success_rate"`          // 成功率
	PromptTokens        int64   `json:"prompt_tokens"`         // 输入Token总量
	CompletionTokens    int64   `json:"completion_tokens"`     // 输出Token总量
	AvgPromptTokens     float64 `json:"avg_prompt_tokens"`     // 平均输入Token
	AvgCompletionTokens float64 `json:"avg_completion_tokens"` // 平均输出Token
	AvgResponseTime     float64 `json:"avg_response_time"`     // 平均响应时间(秒)
	MinResponseTime     float64 `json:"min_response_time"`     // 最小响应时间
	MaxResponseTime     float64 `json:"max_response_time"`     // 最大响应时间
	P50ResponseTime     float64 `json:"p50_response_time"`     // P50响应时间(中位数)
	P90ResponseTime     float64 `json:"p90_response_time"`     // P90响应时间
	P95ResponseTime     float64 `json:"p95_response_time"`     // P95响应时间
	P99ResponseTime     float64 `json:"p99_response_time"`     // P99响应时间
	TotalQuota          int64   `json:"total_quota"`           // 总消耗额度
}

// ChannelModelStatsResponse 分页响应
type ChannelModelStatsResponse struct {
	Data       []ChannelModelStat `json:"data"`
	Total      int64              `json:"total"`
	Page       int                `json:"page"`
	PageSize   int                `json:"page_size"`
	TotalPages int                `json:"total_pages"`
}

// ChannelModelStatsQuery 查询参数
type ChannelModelStatsQuery struct {
	ChannelIds  []int    // 渠道ID列表
	ModelNames  []string // 模型名称列表
	StartTime   int64    // 开始时间戳
	EndTime     int64    // 结束时间戳
	Granularity string   // 时间粒度: hour/day/week/none
	SortBy      string   // 排序字段
	SortOrder   string   // 排序方向: asc/desc
	Page        int      // 页码
	PageSize    int      // 每页数量
	UserId      int      // 用户ID (权限过滤)
}

// ModelOption 模型选项(用于筛选器)
type ModelOption struct {
	ModelName  string `json:"model_name"`
	CallCount  int64  `json:"call_count"`
	ChannelIds []int  `json:"channel_ids"`
}

// GetChannelModelStats 获取渠道+模型详细统计
func GetChannelModelStats(query ChannelModelStatsQuery) (*ChannelModelStatsResponse, error) {
	// 设置默认值
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 {
		query.PageSize = 20
	}
	if query.PageSize > 100 {
		query.PageSize = 100
	}
	if query.Granularity == "" {
		query.Granularity = "none"
	}
	if query.SortBy == "" {
		query.SortBy = "total_calls"
	}
	if query.SortOrder == "" {
		query.SortOrder = "desc"
	}

	// 构建基础统计查询
	var stats []ChannelModelStat
	var total int64

	// 确定时间格式
	var timeFormat string
	var groupByTime string
	if query.Granularity != "none" {
		timeFormat = getTimeFormatSQL(query.Granularity)
		groupByTime = ", time_point"
	} else {
		if common.UsingPostgreSQL {
			timeFormat = "'all'"
		} else {
			timeFormat = "'all'"
		}
		groupByTime = ""
	}

	// 构建SELECT子句
	// 只统计API调用相关的日志 (type=2 成功消费, type=5 错误)
	selectClause := fmt.Sprintf(`
		logs.channel_id,
		COALESCE(channels.name, 'Unknown') as channel_name,
		logs.model_name,
		%s as time_point,
		SUM(CASE WHEN logs.type IN (2, 5) THEN 1 ELSE 0 END) as total_calls,
		SUM(CASE WHEN logs.type = 2 THEN 1 ELSE 0 END) as success_calls,
		SUM(CASE WHEN logs.type = 5 THEN 1 ELSE 0 END) as failed_calls,
		CASE WHEN SUM(CASE WHEN logs.type IN (2, 5) THEN 1 ELSE 0 END) > 0 
			THEN ROUND(SUM(CASE WHEN logs.type = 2 THEN 1 ELSE 0 END) * 100.0 / SUM(CASE WHEN logs.type IN (2, 5) THEN 1 ELSE 0 END), 2) 
			ELSE 0 END as success_rate,
		SUM(CASE WHEN logs.type = 2 THEN logs.prompt_tokens ELSE 0 END) as prompt_tokens,
		SUM(CASE WHEN logs.type = 2 THEN logs.completion_tokens ELSE 0 END) as completion_tokens,
		ROUND(AVG(CASE WHEN logs.type = 2 THEN logs.prompt_tokens ELSE NULL END), 2) as avg_prompt_tokens,
		ROUND(AVG(CASE WHEN logs.type = 2 THEN logs.completion_tokens ELSE NULL END), 2) as avg_completion_tokens,
		ROUND(AVG(CASE WHEN logs.type = 2 THEN logs.use_time ELSE NULL END), 2) as avg_response_time,
		MIN(CASE WHEN logs.type = 2 THEN logs.use_time ELSE NULL END) as min_response_time,
		MAX(CASE WHEN logs.type = 2 THEN logs.use_time ELSE NULL END) as max_response_time,
		SUM(logs.quota) as total_quota
	`, timeFormat)

	// 构建基础查询 - 只统计API调用相关的日志 (type=2 成功消费, type=5 错误)
	baseQuery := LOG_DB.Table("logs").
		Joins("LEFT JOIN channels ON logs.channel_id = channels.id").
		Where("logs.channel_id > 0").
		Where("logs.model_name != ''").
		Where("logs.type IN (2, 5)")

	// 应用筛选条件
	if query.StartTime > 0 {
		baseQuery = baseQuery.Where("logs.created_at >= ?", query.StartTime)
	}
	if query.EndTime > 0 {
		baseQuery = baseQuery.Where("logs.created_at <= ?", query.EndTime)
	}
	if len(query.ChannelIds) > 0 {
		baseQuery = baseQuery.Where("logs.channel_id IN ?", query.ChannelIds)
	}
	if len(query.ModelNames) > 0 {
		baseQuery = baseQuery.Where("logs.model_name IN ?", query.ModelNames)
	}
	if query.UserId > 0 {
		baseQuery = baseQuery.Where("logs.user_id = ?", query.UserId)
	}

	// 构建分组
	groupBy := fmt.Sprintf("logs.channel_id, channels.name, logs.model_name%s", groupByTime)

	// 获取总数(不同的分组组合数) - 只统计API调用相关的日志
	countQuery := LOG_DB.Table("logs").
		Joins("LEFT JOIN channels ON logs.channel_id = channels.id").
		Where("logs.channel_id > 0").
		Where("logs.model_name != ''").
		Where("logs.type IN (2, 5)")

	// 复制筛选条件到计数查询
	if query.StartTime > 0 {
		countQuery = countQuery.Where("logs.created_at >= ?", query.StartTime)
	}
	if query.EndTime > 0 {
		countQuery = countQuery.Where("logs.created_at <= ?", query.EndTime)
	}
	if len(query.ChannelIds) > 0 {
		countQuery = countQuery.Where("logs.channel_id IN ?", query.ChannelIds)
	}
	if len(query.ModelNames) > 0 {
		countQuery = countQuery.Where("logs.model_name IN ?", query.ModelNames)
	}
	if query.UserId > 0 {
		countQuery = countQuery.Where("logs.user_id = ?", query.UserId)
	}

	// 计算分组数量 - 只统计API调用相关的日志 (type IN (2, 5))
	var countResult struct {
		Count int64
	}
	if query.Granularity != "none" {
		countSQL := fmt.Sprintf(`
			SELECT COUNT(*) as count FROM (
				SELECT 1 FROM logs
				LEFT JOIN channels ON logs.channel_id = channels.id
				WHERE logs.channel_id > 0 AND logs.model_name != '' AND logs.type IN (2, 5)
				%s
				GROUP BY logs.channel_id, logs.model_name, %s
			) as subquery
		`, buildWhereClause(query), timeFormat)
		LOG_DB.Raw(countSQL).Scan(&countResult)
	} else {
		countSQL := fmt.Sprintf(`
			SELECT COUNT(*) as count FROM (
				SELECT 1 FROM logs
				LEFT JOIN channels ON logs.channel_id = channels.id
				WHERE logs.channel_id > 0 AND logs.model_name != '' AND logs.type IN (2, 5)
				%s
				GROUP BY logs.channel_id, logs.model_name
			) as subquery
		`, buildWhereClause(query))
		LOG_DB.Raw(countSQL).Scan(&countResult)
	}
	total = countResult.Count

	// 构建排序
	orderClause := fmt.Sprintf("%s %s", getSortColumn(query.SortBy), query.SortOrder)

	// 计算偏移量
	offset := (query.Page - 1) * query.PageSize

	// 执行查询
	err := baseQuery.Select(selectClause).
		Group(groupBy).
		Order(orderClause).
		Offset(offset).
		Limit(query.PageSize).
		Scan(&stats).Error

	if err != nil {
		return nil, err
	}

	// 计算百分位响应时间
	for i := range stats {
		percentiles, err := GetPercentileResponseTime(
			stats[i].ChannelId,
			stats[i].ModelName,
			query.StartTime,
			query.EndTime,
			query.UserId,
		)
		if err == nil {
			stats[i].P50ResponseTime = percentiles.P50
			stats[i].P90ResponseTime = percentiles.P90
			stats[i].P95ResponseTime = percentiles.P95
			stats[i].P99ResponseTime = percentiles.P99
		}
	}

	// 计算总页数
	totalPages := int(total) / query.PageSize
	if int(total)%query.PageSize > 0 {
		totalPages++
	}

	return &ChannelModelStatsResponse{
		Data:       stats,
		Total:      total,
		Page:       query.Page,
		PageSize:   query.PageSize,
		TotalPages: totalPages,
	}, nil
}

// buildWhereClause 构建WHERE子句
func buildWhereClause(query ChannelModelStatsQuery) string {
	where := ""
	if query.StartTime > 0 {
		where += fmt.Sprintf(" AND logs.created_at >= %d", query.StartTime)
	}
	if query.EndTime > 0 {
		where += fmt.Sprintf(" AND logs.created_at <= %d", query.EndTime)
	}
	if len(query.ChannelIds) > 0 {
		ids := ""
		for i, id := range query.ChannelIds {
			if i > 0 {
				ids += ","
			}
			ids += fmt.Sprintf("%d", id)
		}
		where += fmt.Sprintf(" AND logs.channel_id IN (%s)", ids)
	}
	if len(query.ModelNames) > 0 {
		names := ""
		for i, name := range query.ModelNames {
			if i > 0 {
				names += ","
			}
			names += fmt.Sprintf("'%s'", name)
		}
		where += fmt.Sprintf(" AND logs.model_name IN (%s)", names)
	}
	if query.UserId > 0 {
		where += fmt.Sprintf(" AND logs.user_id = %d", query.UserId)
	}
	return where
}

// getSortColumn 获取排序列名
func getSortColumn(sortBy string) string {
	columnMap := map[string]string{
		"total_calls":           "total_calls",
		"success_calls":         "success_calls",
		"failed_calls":          "failed_calls",
		"success_rate":          "success_rate",
		"prompt_tokens":         "prompt_tokens",
		"completion_tokens":     "completion_tokens",
		"avg_prompt_tokens":     "avg_prompt_tokens",
		"avg_completion_tokens": "avg_completion_tokens",
		"avg_response_time":     "avg_response_time",
		"min_response_time":     "min_response_time",
		"max_response_time":     "max_response_time",
		"total_quota":           "total_quota",
		"channel_id":            "logs.channel_id",
		"channel_name":          "channel_name",
		"model_name":            "logs.model_name",
		"time_point":            "time_point",
	}
	if col, ok := columnMap[sortBy]; ok {
		return col
	}
	return "total_calls"
}

// PercentileResult 百分位结果
type PercentileResult struct {
	P50 float64
	P90 float64
	P95 float64
	P99 float64
}

// GetPercentileResponseTime 获取百分位响应时间
func GetPercentileResponseTime(channelId int, modelName string, startTime, endTime int64, userId int) (*PercentileResult, error) {
	if common.UsingPostgreSQL {
		return getPercentilePostgreSQL(channelId, modelName, startTime, endTime, userId)
	}
	return getPercentileGeneric(channelId, modelName, startTime, endTime, userId)
}

// getPercentilePostgreSQL PostgreSQL原生百分位数计算
func getPercentilePostgreSQL(channelId int, modelName string, startTime, endTime int64, userId int) (*PercentileResult, error) {
	var result PercentileResult

	query := `
		SELECT
			COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY use_time), 0) as p50,
			COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY use_time), 0) as p90,
			COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY use_time), 0) as p95,
			COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY use_time), 0) as p99
		FROM logs
		WHERE type = 2 AND channel_id = ? AND model_name = ?
	`

	args := []interface{}{channelId, modelName}

	if startTime > 0 {
		query += " AND created_at >= ?"
		args = append(args, startTime)
	}
	if endTime > 0 {
		query += " AND created_at <= ?"
		args = append(args, endTime)
	}
	if userId > 0 {
		query += " AND user_id = ?"
		args = append(args, userId)
	}

	err := LOG_DB.Raw(query, args...).Scan(&result).Error
	return &result, err
}

// getPercentileGeneric 通用百分位数计算(应用层计算)
func getPercentileGeneric(channelId int, modelName string, startTime, endTime int64, userId int) (*PercentileResult, error) {
	var useTimes []float64

	query := LOG_DB.Table("logs").
		Select("use_time").
		Where("type = 2").
		Where("channel_id = ?", channelId).
		Where("model_name = ?", modelName).
		Where("use_time > 0")

	if startTime > 0 {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("created_at <= ?", endTime)
	}
	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}

	// 限制最多取10000条数据计算百分位
	err := query.Order("use_time ASC").Limit(10000).Pluck("use_time", &useTimes).Error
	if err != nil {
		return nil, err
	}

	if len(useTimes) == 0 {
		return &PercentileResult{}, nil
	}

	// 数据已排序，直接计算百分位
	sort.Float64s(useTimes)

	return &PercentileResult{
		P50: calculatePercentile(useTimes, 0.5),
		P90: calculatePercentile(useTimes, 0.9),
		P95: calculatePercentile(useTimes, 0.95),
		P99: calculatePercentile(useTimes, 0.99),
	}, nil
}

// calculatePercentile 计算百分位值
func calculatePercentile(sortedData []float64, percentile float64) float64 {
	if len(sortedData) == 0 {
		return 0
	}
	if len(sortedData) == 1 {
		return sortedData[0]
	}

	index := percentile * float64(len(sortedData)-1)
	lower := int(index)
	upper := lower + 1

	if upper >= len(sortedData) {
		return sortedData[len(sortedData)-1]
	}

	// 线性插值
	weight := index - float64(lower)
	return sortedData[lower]*(1-weight) + sortedData[upper]*weight
}

// GetDistinctModels 获取可用模型列表
func GetDistinctModels(channelIds []int, startTime, endTime int64, userId int) ([]ModelOption, error) {
	// 使用临时结构体避免 GORM 扫描 ChannelIds 切片字段
	type tempModelOption struct {
		ModelName string `json:"model_name"`
		CallCount int64  `json:"call_count"`
	}
	var tempOptions []tempModelOption

	// 只统计API调用相关的日志 (type=2 成功消费, type=5 错误)
	query := LOG_DB.Table("logs").
		Select(`
			model_name,
			COUNT(*) as call_count
		`).
		Where("channel_id > 0").
		Where("model_name != ''").
		Where("type IN (2, 5)")

	if startTime > 0 {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("created_at <= ?", endTime)
	}
	if len(channelIds) > 0 {
		query = query.Where("channel_id IN ?", channelIds)
	}
	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}

	err := query.Group("model_name").
		Order("call_count DESC").
		Scan(&tempOptions).Error

	if err != nil {
		return nil, err
	}

	// 转换为 ModelOption
	options := make([]ModelOption, len(tempOptions))
	for i, temp := range tempOptions {
		options[i] = ModelOption{
			ModelName: temp.ModelName,
			CallCount: temp.CallCount,
		}
	}

	// 获取每个模型对应的渠道ID列表
	for i := range options {
		var channelIdList []int
		channelQuery := LOG_DB.Table("logs").
			Select("DISTINCT channel_id").
			Where("model_name = ?", options[i].ModelName).
			Where("channel_id > 0").
			Where("type IN (2, 5)")

		if startTime > 0 {
			channelQuery = channelQuery.Where("created_at >= ?", startTime)
		}
		if endTime > 0 {
			channelQuery = channelQuery.Where("created_at <= ?", endTime)
		}
		if userId > 0 {
			channelQuery = channelQuery.Where("user_id = ?", userId)
		}

		channelQuery.Pluck("channel_id", &channelIdList)
		options[i].ChannelIds = channelIdList
	}

	return options, nil
}

// GetChannelModelSummary 获取渠道模型汇总统计(用于概览卡片)
func GetChannelModelSummary(query ChannelModelStatsQuery) (map[string]interface{}, error) {
	summary := make(map[string]interface{})

	// 只统计API调用相关的日志 (type=2 成功消费, type=5 错误)
	baseQuery := LOG_DB.Table("logs").
		Where("channel_id > 0").
		Where("model_name != ''").
		Where("type IN (2, 5)")

	if query.StartTime > 0 {
		baseQuery = baseQuery.Where("created_at >= ?", query.StartTime)
	}
	if query.EndTime > 0 {
		baseQuery = baseQuery.Where("created_at <= ?", query.EndTime)
	}
	if len(query.ChannelIds) > 0 {
		baseQuery = baseQuery.Where("channel_id IN ?", query.ChannelIds)
	}
	if len(query.ModelNames) > 0 {
		baseQuery = baseQuery.Where("model_name IN ?", query.ModelNames)
	}
	if query.UserId > 0 {
		baseQuery = baseQuery.Where("user_id = ?", query.UserId)
	}

	// 总调用次数 (成功+失败)
	var totalCalls int64
	baseQuery.Count(&totalCalls)
	summary["total_calls"] = totalCalls

	// 成功调用次数
	var successCalls int64
	LOG_DB.Table("logs").
		Where("channel_id > 0").
		Where("model_name != ''").
		Where("type = 2").
		Where(buildSummaryWhere(query)).
		Count(&successCalls)
	summary["success_calls"] = successCalls

	// 失败调用次数
	var failedCalls int64
	LOG_DB.Table("logs").
		Where("channel_id > 0").
		Where("model_name != ''").
		Where("type = 5").
		Where(buildSummaryWhere(query)).
		Count(&failedCalls)
	summary["failed_calls"] = failedCalls

	// 成功率
	if totalCalls > 0 {
		summary["success_rate"] = float64(successCalls) * 100.0 / float64(totalCalls)
	} else {
		summary["success_rate"] = 0.0
	}

	// Token统计
	var tokenStats struct {
		TotalPromptTokens     int64
		TotalCompletionTokens int64
		AvgPromptTokens       float64
		AvgCompletionTokens   float64
	}
	LOG_DB.Table("logs").
		Select(`
			SUM(prompt_tokens) as total_prompt_tokens,
			SUM(completion_tokens) as total_completion_tokens,
			AVG(prompt_tokens) as avg_prompt_tokens,
			AVG(completion_tokens) as avg_completion_tokens
		`).
		Where("channel_id > 0").
		Where("model_name != ''").
		Where(buildSummaryWhere(query)).
		Scan(&tokenStats)

	summary["total_prompt_tokens"] = tokenStats.TotalPromptTokens
	summary["total_completion_tokens"] = tokenStats.TotalCompletionTokens
	summary["avg_prompt_tokens"] = tokenStats.AvgPromptTokens
	summary["avg_completion_tokens"] = tokenStats.AvgCompletionTokens

	// 响应时间统计
	var timeStats struct {
		AvgResponseTime float64
		MinResponseTime float64
		MaxResponseTime float64
	}
	LOG_DB.Table("logs").
		Select(`
			AVG(use_time) as avg_response_time,
			MIN(use_time) as min_response_time,
			MAX(use_time) as max_response_time
		`).
		Where("channel_id > 0").
		Where("model_name != ''").
		Where("type = 2").
		Where(buildSummaryWhere(query)).
		Scan(&timeStats)

	summary["avg_response_time"] = timeStats.AvgResponseTime
	summary["min_response_time"] = timeStats.MinResponseTime
	summary["max_response_time"] = timeStats.MaxResponseTime

	// 总消耗额度
	var totalQuota int64
	LOG_DB.Table("logs").
		Select("SUM(quota)").
		Where("channel_id > 0").
		Where("model_name != ''").
		Where(buildSummaryWhere(query)).
		Pluck("SUM(quota)", &totalQuota)
	summary["total_quota"] = totalQuota

	// 唯一渠道数
	var uniqueChannels int64
	LOG_DB.Table("logs").
		Select("COUNT(DISTINCT channel_id)").
		Where("channel_id > 0").
		Where("model_name != ''").
		Where(buildSummaryWhere(query)).
		Pluck("COUNT(DISTINCT channel_id)", &uniqueChannels)
	summary["unique_channels"] = uniqueChannels

	// 唯一模型数
	var uniqueModels int64
	LOG_DB.Table("logs").
		Select("COUNT(DISTINCT model_name)").
		Where("channel_id > 0").
		Where("model_name != ''").
		Where(buildSummaryWhere(query)).
		Pluck("COUNT(DISTINCT model_name)", &uniqueModels)
	summary["unique_models"] = uniqueModels

	return summary, nil
}

// TokenRangeStat Token范围统计
type TokenRangeStat struct {
	TokenRange      string  `json:"token_range"`       // Token范围区间
	TokenType       string  `json:"token_type"`        // prompt/completion
	CallCount       int64   `json:"call_count"`        // 调用次数
	AvgResponseTime float64 `json:"avg_response_time"` // 平均响应时间
	MinResponseTime float64 `json:"min_response_time"` // 最小响应时间
	MaxResponseTime float64 `json:"max_response_time"` // 最大响应时间
	P50ResponseTime float64 `json:"p50_response_time"` // P50响应时间
	P90ResponseTime float64 `json:"p90_response_time"` // P90响应时间
	P95ResponseTime float64 `json:"p95_response_time"` // P95响应时间
	P99ResponseTime float64 `json:"p99_response_time"` // P99响应时间
	AvgTokens       float64 `json:"avg_tokens"`        // 平均Token数
	TotalTokens     int64   `json:"total_tokens"`      // 总Token数
}

// TokenRangeDetailStat Token范围详细统计（按渠道/模型细分）
type TokenRangeDetailStat struct {
	ChannelId       int     `json:"channel_id"`
	ChannelName     string  `json:"channel_name"`
	ModelName       string  `json:"model_name"`
	TokenRange      string  `json:"token_range"`
	TokenType       string  `json:"token_type"`
	CallCount       int64   `json:"call_count"`
	AvgResponseTime float64 `json:"avg_response_time"`
	P50ResponseTime float64 `json:"p50_response_time"`
	P90ResponseTime float64 `json:"p90_response_time"`
	P95ResponseTime float64 `json:"p95_response_time"`
	P99ResponseTime float64 `json:"p99_response_time"`
}

// Token范围定义
var TokenRanges = []struct {
	Name string
	Min  int
	Max  int
}{
	{"0-500", 0, 500},
	{"500-1K", 500, 1000},
	{"1K-5K", 1000, 5000},
	{"5K-10K", 5000, 10000},
	{"10K-20K", 10000, 20000},
	{"20K-30K", 20000, 30000},
	{"30K-50K", 30000, 50000},
	{"50K-70K", 50000, 70000},
	{"70K-100K", 70000, 100000},
	{"100K+", 100000, -1}, // -1 表示无上限
}

// GetTokenRangeStats 获取Token范围统计
func GetTokenRangeStats(query ChannelModelStatsQuery, tokenType string) ([]TokenRangeStat, error) {
	var stats []TokenRangeStat

	// 确定Token字段
	tokenField := "prompt_tokens"
	if tokenType == "completion" {
		tokenField = "completion_tokens"
	}

	for _, tr := range TokenRanges {
		stat := TokenRangeStat{
			TokenRange: tr.Name,
			TokenType:  tokenType,
		}

		// 构建基础查询
		baseQuery := LOG_DB.Table("logs").
			Where("type = 2"). // 只统计成功的请求
			Where("channel_id > 0").
			Where("model_name != ''")

		// 应用筛选条件
		if query.StartTime > 0 {
			baseQuery = baseQuery.Where("created_at >= ?", query.StartTime)
		}
		if query.EndTime > 0 {
			baseQuery = baseQuery.Where("created_at <= ?", query.EndTime)
		}
		if len(query.ChannelIds) > 0 {
			baseQuery = baseQuery.Where("channel_id IN ?", query.ChannelIds)
		}
		if len(query.ModelNames) > 0 {
			baseQuery = baseQuery.Where("model_name IN ?", query.ModelNames)
		}
		if query.UserId > 0 {
			baseQuery = baseQuery.Where("user_id = ?", query.UserId)
		}

		// Token范围条件
		baseQuery = baseQuery.Where(tokenField+" >= ?", tr.Min)
		if tr.Max > 0 {
			baseQuery = baseQuery.Where(tokenField+" < ?", tr.Max)
		}

		// 获取基础统计
		var basicStat struct {
			CallCount       int64
			AvgResponseTime float64
			MinResponseTime float64
			MaxResponseTime float64
			AvgTokens       float64
			TotalTokens     int64
		}

		baseQuery.Select(`
			COUNT(*) as call_count,
			COALESCE(AVG(use_time), 0) as avg_response_time,
			COALESCE(MIN(use_time), 0) as min_response_time,
			COALESCE(MAX(use_time), 0) as max_response_time,
			COALESCE(AVG(` + tokenField + `), 0) as avg_tokens,
			COALESCE(SUM(` + tokenField + `), 0) as total_tokens
		`).Scan(&basicStat)

		stat.CallCount = basicStat.CallCount
		stat.AvgResponseTime = basicStat.AvgResponseTime
		stat.MinResponseTime = basicStat.MinResponseTime
		stat.MaxResponseTime = basicStat.MaxResponseTime
		stat.AvgTokens = basicStat.AvgTokens
		stat.TotalTokens = basicStat.TotalTokens

		// 如果有数据，计算百分位
		if stat.CallCount > 0 {
			percentiles := getTokenRangePercentiles(query, tokenType, tr.Min, tr.Max)
			stat.P50ResponseTime = percentiles.P50
			stat.P90ResponseTime = percentiles.P90
			stat.P95ResponseTime = percentiles.P95
			stat.P99ResponseTime = percentiles.P99
		}

		stats = append(stats, stat)
	}

	return stats, nil
}

// getTokenRangePercentiles 获取特定Token范围的响应时间百分位
func getTokenRangePercentiles(query ChannelModelStatsQuery, tokenType string, minToken, maxToken int) *PercentileResult {
	tokenField := "prompt_tokens"
	if tokenType == "completion" {
		tokenField = "completion_tokens"
	}

	if common.UsingPostgreSQL {
		var result PercentileResult
		sqlQuery := `
			SELECT
				COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY use_time), 0) as p50,
				COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY use_time), 0) as p90,
				COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY use_time), 0) as p95,
				COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY use_time), 0) as p99
			FROM logs
			WHERE type = 2 AND channel_id > 0 AND model_name != ''
			AND ` + tokenField + ` >= ?
		`
		args := []interface{}{minToken}

		if maxToken > 0 {
			sqlQuery += " AND " + tokenField + " < ?"
			args = append(args, maxToken)
		}

		if query.StartTime > 0 {
			sqlQuery += " AND created_at >= ?"
			args = append(args, query.StartTime)
		}
		if query.EndTime > 0 {
			sqlQuery += " AND created_at <= ?"
			args = append(args, query.EndTime)
		}
		if len(query.ChannelIds) > 0 {
			sqlQuery += " AND channel_id IN ?"
			args = append(args, query.ChannelIds)
		}
		if len(query.ModelNames) > 0 {
			sqlQuery += " AND model_name IN ?"
			args = append(args, query.ModelNames)
		}
		if query.UserId > 0 {
			sqlQuery += " AND user_id = ?"
			args = append(args, query.UserId)
		}

		LOG_DB.Raw(sqlQuery, args...).Scan(&result)
		return &result
	}

	// MySQL/SQLite: 使用应用层计算
	var useTimes []float64
	baseQuery := LOG_DB.Table("logs").
		Select("use_time").
		Where("type = 2").
		Where("channel_id > 0").
		Where("model_name != ''").
		Where("use_time > 0").
		Where(tokenField+" >= ?", minToken)

	if maxToken > 0 {
		baseQuery = baseQuery.Where(tokenField+" < ?", maxToken)
	}
	if query.StartTime > 0 {
		baseQuery = baseQuery.Where("created_at >= ?", query.StartTime)
	}
	if query.EndTime > 0 {
		baseQuery = baseQuery.Where("created_at <= ?", query.EndTime)
	}
	if len(query.ChannelIds) > 0 {
		baseQuery = baseQuery.Where("channel_id IN ?", query.ChannelIds)
	}
	if len(query.ModelNames) > 0 {
		baseQuery = baseQuery.Where("model_name IN ?", query.ModelNames)
	}
	if query.UserId > 0 {
		baseQuery = baseQuery.Where("user_id = ?", query.UserId)
	}

	baseQuery.Order("use_time ASC").Limit(10000).Pluck("use_time", &useTimes)

	if len(useTimes) == 0 {
		return &PercentileResult{}
	}

	return &PercentileResult{
		P50: calculatePercentile(useTimes, 0.5),
		P90: calculatePercentile(useTimes, 0.9),
		P95: calculatePercentile(useTimes, 0.95),
		P99: calculatePercentile(useTimes, 0.99),
	}
}

// GetTokenRangeDetailStats 获取Token范围详细统计（按渠道/模型细分）
func GetTokenRangeDetailStats(query ChannelModelStatsQuery, tokenType string) ([]TokenRangeDetailStat, error) {
	var stats []TokenRangeDetailStat

	tokenField := "prompt_tokens"
	if tokenType == "completion" {
		tokenField = "completion_tokens"
	}

	for _, tr := range TokenRanges {
		// 构建CASE语句用于Token范围
		var rangeCondition string
		if tr.Max > 0 {
			rangeCondition = fmt.Sprintf("%s >= %d AND %s < %d", tokenField, tr.Min, tokenField, tr.Max)
		} else {
			rangeCondition = fmt.Sprintf("%s >= %d", tokenField, tr.Min)
		}

		var rangeStats []TokenRangeDetailStat
		baseQuery := LOG_DB.Table("logs").
			Select(`
				logs.channel_id,
				COALESCE(channels.name, 'Unknown') as channel_name,
				logs.model_name,
				COUNT(*) as call_count,
				COALESCE(AVG(logs.use_time), 0) as avg_response_time
			`).
			Joins("LEFT JOIN channels ON logs.channel_id = channels.id").
			Where("logs.type = 2").
			Where("logs.channel_id > 0").
			Where("logs.model_name != ''").
			Where(rangeCondition)

		if query.StartTime > 0 {
			baseQuery = baseQuery.Where("logs.created_at >= ?", query.StartTime)
		}
		if query.EndTime > 0 {
			baseQuery = baseQuery.Where("logs.created_at <= ?", query.EndTime)
		}
		if len(query.ChannelIds) > 0 {
			baseQuery = baseQuery.Where("logs.channel_id IN ?", query.ChannelIds)
		}
		if len(query.ModelNames) > 0 {
			baseQuery = baseQuery.Where("logs.model_name IN ?", query.ModelNames)
		}
		if query.UserId > 0 {
			baseQuery = baseQuery.Where("logs.user_id = ?", query.UserId)
		}

		baseQuery.Group("logs.channel_id, channels.name, logs.model_name").
			Having("COUNT(*) > 0").
			Scan(&rangeStats)

		for i := range rangeStats {
			rangeStats[i].TokenRange = tr.Name
			rangeStats[i].TokenType = tokenType
		}

		stats = append(stats, rangeStats...)
	}

	return stats, nil
}

// buildSummaryWhere 构建汇总查询的WHERE条件
func buildSummaryWhere(query ChannelModelStatsQuery) string {
	where := "1=1"
	if query.StartTime > 0 {
		where += fmt.Sprintf(" AND created_at >= %d", query.StartTime)
	}
	if query.EndTime > 0 {
		where += fmt.Sprintf(" AND created_at <= %d", query.EndTime)
	}
	if len(query.ChannelIds) > 0 {
		ids := ""
		for i, id := range query.ChannelIds {
			if i > 0 {
				ids += ","
			}
			ids += fmt.Sprintf("%d", id)
		}
		where += fmt.Sprintf(" AND channel_id IN (%s)", ids)
	}
	if len(query.ModelNames) > 0 {
		names := ""
		for i, name := range query.ModelNames {
			if i > 0 {
				names += ","
			}
			names += fmt.Sprintf("'%s'", name)
		}
		where += fmt.Sprintf(" AND model_name IN (%s)", names)
	}
	if query.UserId > 0 {
		where += fmt.Sprintf(" AND user_id = %d", query.UserId)
	}
	return where
}

