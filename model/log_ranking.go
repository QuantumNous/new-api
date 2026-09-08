package model

import (
	"strings"

	"gorm.io/gorm"
)

const (
	UsageRankingSortQuota        = "quota"
	UsageRankingSortRequestCount = "request_count"
)

type UsageRankingQuery struct {
	StartTimestamp int64
	EndTimestamp   int64
	ModelName      string
	ChannelID      int
	Group          string
	SortBy         string
	Page           int
	PageSize       int
}

type UsageRankingGroupStat struct {
	UserID           int                       `json:"-" gorm:"column:user_id"`
	Username         string                    `json:"-" gorm:"column:username"`
	Group            string                    `json:"group" gorm:"column:group"`
	Quota            int64                     `json:"quota" gorm:"column:quota"`
	RequestCount     int64                     `json:"request_count" gorm:"column:request_count"`
	PromptTokens     int64                     `json:"prompt_tokens" gorm:"column:prompt_tokens"`
	CompletionTokens int64                     `json:"completion_tokens" gorm:"column:completion_tokens"`
	TotalTokens      int64                     `json:"total_tokens" gorm:"column:total_tokens"`
	AverageUseTime   float64                   `json:"avg_use_time" gorm:"column:avg_use_time"`
	StreamCount      int64                     `json:"stream_count" gorm:"column:stream_count"`
	StreamRatio      float64                   `json:"stream_ratio" gorm:"-"`
	ErrorCount       int64                     `json:"error_count" gorm:"-"`
	ErrorRate        float64                   `json:"error_rate" gorm:"-"`
	ModelCount       int64                     `json:"model_count" gorm:"column:model_count"`
	TokenCount       int64                     `json:"token_count" gorm:"column:token_count"`
	ChannelCount     int64                     `json:"channel_count" gorm:"column:channel_count"`
	LastUsedAt       int64                     `json:"last_used_at" gorm:"column:last_used_at"`
	ModelStats       []UsageRankingModelStat   `json:"model_stats" gorm:"-"`
	ChannelStats     []UsageRankingChannelStat `json:"channel_stats" gorm:"-"`
}

type UsageRankingModelStat struct {
	UserID           int     `json:"-" gorm:"column:user_id"`
	Username         string  `json:"-" gorm:"column:username"`
	Group            string  `json:"-" gorm:"column:group"`
	ModelName        string  `json:"model_name" gorm:"column:model_name"`
	Quota            int64   `json:"quota" gorm:"column:quota"`
	QuotaRatio       float64 `json:"quota_ratio" gorm:"-"`
	RequestCount     int64   `json:"request_count" gorm:"column:request_count"`
	PromptTokens     int64   `json:"prompt_tokens" gorm:"column:prompt_tokens"`
	CompletionTokens int64   `json:"completion_tokens" gorm:"column:completion_tokens"`
	TotalTokens      int64   `json:"total_tokens" gorm:"column:total_tokens"`
	LastUsedAt       int64   `json:"last_used_at" gorm:"column:last_used_at"`
}

type UsageRankingChannelStat struct {
	UserID           int     `json:"-" gorm:"column:user_id"`
	Username         string  `json:"-" gorm:"column:username"`
	Group            string  `json:"-" gorm:"column:group"`
	ChannelID        int     `json:"channel_id" gorm:"column:channel_id"`
	ChannelName      string  `json:"channel_name" gorm:"-"`
	Quota            int64   `json:"quota" gorm:"column:quota"`
	QuotaRatio       float64 `json:"quota_ratio" gorm:"-"`
	RequestCount     int64   `json:"request_count" gorm:"column:request_count"`
	PromptTokens     int64   `json:"prompt_tokens" gorm:"column:prompt_tokens"`
	CompletionTokens int64   `json:"completion_tokens" gorm:"column:completion_tokens"`
	TotalTokens      int64   `json:"total_tokens" gorm:"column:total_tokens"`
	LastUsedAt       int64   `json:"last_used_at" gorm:"column:last_used_at"`
}

type UsageRankingItem struct {
	Rank             int                     `json:"rank" gorm:"-"`
	UserID           int                     `json:"user_id" gorm:"column:user_id"`
	Username         string                  `json:"username" gorm:"column:username"`
	Quota            int64                   `json:"quota" gorm:"column:quota"`
	RequestCount     int64                   `json:"request_count" gorm:"column:request_count"`
	PromptTokens     int64                   `json:"prompt_tokens" gorm:"column:prompt_tokens"`
	CompletionTokens int64                   `json:"completion_tokens" gorm:"column:completion_tokens"`
	TotalTokens      int64                   `json:"total_tokens" gorm:"column:total_tokens"`
	AverageUseTime   float64                 `json:"avg_use_time" gorm:"column:avg_use_time"`
	StreamCount      int64                   `json:"stream_count" gorm:"column:stream_count"`
	StreamRatio      float64                 `json:"stream_ratio" gorm:"-"`
	ErrorCount       int64                   `json:"error_count" gorm:"-"`
	ErrorRate        float64                 `json:"error_rate" gorm:"-"`
	ModelCount       int64                   `json:"model_count" gorm:"column:model_count"`
	TokenCount       int64                   `json:"token_count" gorm:"column:token_count"`
	GroupCount       int64                   `json:"group_count" gorm:"column:group_count"`
	ChannelCount     int64                   `json:"channel_count" gorm:"column:channel_count"`
	LastUsedAt       int64                   `json:"last_used_at" gorm:"column:last_used_at"`
	GroupStats       []UsageRankingGroupStat `json:"group_stats" gorm:"-"`
}

type UsageRankingSummary struct {
	Quota            int64 `json:"quota" gorm:"column:quota"`
	RequestCount     int64 `json:"request_count" gorm:"column:request_count"`
	PromptTokens     int64 `json:"prompt_tokens" gorm:"column:prompt_tokens"`
	CompletionTokens int64 `json:"completion_tokens" gorm:"column:completion_tokens"`
	TotalTokens      int64 `json:"total_tokens" gorm:"column:total_tokens"`
	ActiveUserCount  int64 `json:"active_user_count" gorm:"-"`
}

type UsageRankingResult struct {
	Items   []UsageRankingItem  `json:"items"`
	Total   int64               `json:"total"`
	Summary UsageRankingSummary `json:"summary"`
}

type usageRankingIdentity struct {
	UserID   int
	Username string
}

type usageRankingGroupIdentity struct {
	UserID   int
	Username string
	Group    string
}

type usageRankingErrorRow struct {
	UserID     int    `gorm:"column:user_id"`
	Username   string `gorm:"column:username"`
	Group      string `gorm:"column:group"`
	ErrorCount int64  `gorm:"column:error_count"`
}

func normalizeUsageRankingQuery(query UsageRankingQuery) UsageRankingQuery {
	if query.Page < 1 {
		query.Page = 1
	}
	if query.PageSize < 1 {
		query.PageSize = 20
	}
	if query.PageSize > 100 {
		query.PageSize = 100
	}
	query.SortBy = strings.ToLower(strings.TrimSpace(query.SortBy))
	if query.SortBy != UsageRankingSortRequestCount {
		query.SortBy = UsageRankingSortQuota
	}
	return query
}

func applyUsageRankingFilters(tx *gorm.DB, query UsageRankingQuery, logType int) (*gorm.DB, error) {
	tx = tx.Where("type = ?", logType)
	if query.StartTimestamp != 0 {
		tx = tx.Where("created_at >= ?", query.StartTimestamp)
	}
	if query.EndTimestamp != 0 {
		tx = tx.Where("created_at <= ?", query.EndTimestamp)
	}
	var err error
	if tx, err = applyExplicitLogTextFilter(tx, "model_name", query.ModelName); err != nil {
		return nil, err
	}
	if query.ChannelID != 0 {
		tx = tx.Where("channel_id = ?", query.ChannelID)
	}
	if query.Group != "" {
		tx = tx.Where(logGroupCol+" = ?", query.Group)
	}
	return tx, nil
}

func usageRankingAggregateQuery(query UsageRankingQuery) (*gorm.DB, error) {
	tx := LOG_DB.Table("logs").Select(`user_id,
		username,
		COALESCE(SUM(quota), 0) AS quota,
		COUNT(*) AS request_count,
		COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
		COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
		COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0) AS total_tokens,
		COALESCE(AVG(use_time), 0) AS avg_use_time,
		COALESCE(SUM(CASE WHEN is_stream THEN 1 ELSE 0 END), 0) AS stream_count,
		COUNT(DISTINCT model_name) AS model_count,
		COUNT(DISTINCT token_id) AS token_count,
		COUNT(DISTINCT ` + logGroupCol + `) AS group_count,
		COUNT(DISTINCT channel_id) AS channel_count,
		MAX(created_at) AS last_used_at`)
	tx, err := applyUsageRankingFilters(tx, query, LogTypeConsume)
	if err != nil {
		return nil, err
	}
	return tx.Group("user_id, username"), nil
}

func applyUsageRankingUserScope(tx *gorm.DB, users []usageRankingIdentity) *gorm.DB {
	if len(users) == 0 {
		return tx.Where("1 = 0")
	}
	conditions := make([]string, 0, len(users))
	args := make([]any, 0, len(users)*2)
	for _, user := range users {
		conditions = append(conditions, "(user_id = ? AND username = ?)")
		args = append(args, user.UserID, user.Username)
	}
	return tx.Where("("+strings.Join(conditions, " OR ")+")", args...)
}

func GetUsageRanking(query UsageRankingQuery) (UsageRankingResult, error) {
	query = normalizeUsageRankingQuery(query)
	result := UsageRankingResult{Items: []UsageRankingItem{}}

	aggregateQuery, err := usageRankingAggregateQuery(query)
	if err != nil {
		return result, err
	}
	countQuery := aggregateQuery.Select("user_id, username")
	if err = LOG_DB.Table("(?) AS usage_ranking_count", countQuery).Count(&result.Total).Error; err != nil {
		return result, err
	}
	if result.Total == 0 {
		return result, nil
	}

	summaryQuery, err := applyUsageRankingFilters(LOG_DB.Table("logs"), query, LogTypeConsume)
	if err != nil {
		return result, err
	}
	if err = summaryQuery.Select(`COALESCE(SUM(quota), 0) AS quota,
		COUNT(*) AS request_count,
		COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
		COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
		COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0) AS total_tokens`).
		Scan(&result.Summary).Error; err != nil {
		return result, err
	}
	result.Summary.ActiveUserCount = result.Total

	aggregateQuery, err = usageRankingAggregateQuery(query)
	if err != nil {
		return result, err
	}
	offset := (query.Page - 1) * query.PageSize
	if err = aggregateQuery.Order(query.SortBy + " DESC, user_id ASC, username ASC").
		Limit(query.PageSize).
		Offset(offset).
		Scan(&result.Items).Error; err != nil {
		return result, err
	}
	if len(result.Items) == 0 {
		return result, nil
	}

	users := make([]usageRankingIdentity, 0, len(result.Items))
	for i := range result.Items {
		result.Items[i].Rank = offset + i + 1
		result.Items[i].GroupStats = []UsageRankingGroupStat{}
		users = append(users, usageRankingIdentity{UserID: result.Items[i].UserID, Username: result.Items[i].Username})
	}

	groupQuery := LOG_DB.Table("logs").Select(`user_id,
		username,
		` + logGroupCol + ` AS ` + logGroupCol + `,
		COALESCE(SUM(quota), 0) AS quota,
		COUNT(*) AS request_count,
		COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
		COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
		COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0) AS total_tokens,
		COALESCE(AVG(use_time), 0) AS avg_use_time,
		COALESCE(SUM(CASE WHEN is_stream THEN 1 ELSE 0 END), 0) AS stream_count,
		COUNT(DISTINCT model_name) AS model_count,
		COUNT(DISTINCT token_id) AS token_count,
		COUNT(DISTINCT channel_id) AS channel_count,
		MAX(created_at) AS last_used_at`)
	groupQuery, err = applyUsageRankingFilters(groupQuery, query, LogTypeConsume)
	if err != nil {
		return result, err
	}
	groupQuery = applyUsageRankingUserScope(groupQuery, users)
	var groupRows []UsageRankingGroupStat
	if err = groupQuery.Group("user_id, username, " + logGroupCol).
		Order("quota DESC, request_count DESC, " + logGroupCol + " ASC").
		Scan(&groupRows).Error; err != nil {
		return result, err
	}

	modelQuery := LOG_DB.Table("logs").Select(`user_id,
		username,
		` + logGroupCol + ` AS ` + logGroupCol + `,
		model_name,
		COALESCE(SUM(quota), 0) AS quota,
		COUNT(*) AS request_count,
		COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
		COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
		COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0) AS total_tokens,
		MAX(created_at) AS last_used_at`)
	modelQuery, err = applyUsageRankingFilters(modelQuery, query, LogTypeConsume)
	if err != nil {
		return result, err
	}
	modelQuery = applyUsageRankingUserScope(modelQuery, users)
	var modelRows []UsageRankingModelStat
	if err = modelQuery.Group("user_id, username, " + logGroupCol + ", model_name").
		Order("quota DESC, request_count DESC, model_name ASC").
		Scan(&modelRows).Error; err != nil {
		return result, err
	}

	channelQuery := LOG_DB.Table("logs").Select(`user_id,
		username,
		` + logGroupCol + ` AS ` + logGroupCol + `,
		channel_id,
		COALESCE(SUM(quota), 0) AS quota,
		COUNT(*) AS request_count,
		COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
		COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
		COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0) AS total_tokens,
		MAX(created_at) AS last_used_at`)
	channelQuery, err = applyUsageRankingFilters(channelQuery, query, LogTypeConsume)
	if err != nil {
		return result, err
	}
	channelQuery = applyUsageRankingUserScope(channelQuery, users)
	var channelRows []UsageRankingChannelStat
	if err = channelQuery.Group("user_id, username, " + logGroupCol + ", channel_id").
		Order("quota DESC, request_count DESC, channel_id ASC").
		Scan(&channelRows).Error; err != nil {
		return result, err
	}

	channelIDs := make([]int, 0)
	channelIDSet := make(map[int]struct{})
	for _, row := range channelRows {
		if row.ChannelID <= 0 {
			continue
		}
		if _, ok := channelIDSet[row.ChannelID]; ok {
			continue
		}
		channelIDSet[row.ChannelID] = struct{}{}
		channelIDs = append(channelIDs, row.ChannelID)
	}
	channelNameByID := make(map[int]string, len(channelIDs))
	if len(channelIDs) > 0 {
		var channels []struct {
			ID   int    `gorm:"column:id"`
			Name string `gorm:"column:name"`
		}
		if err = DB.Table("channels").Select("id, name").Where("id IN ?", channelIDs).Find(&channels).Error; err != nil {
			return result, err
		}
		for _, channel := range channels {
			channelNameByID[channel.ID] = channel.Name
		}
	}
	for i := range channelRows {
		channelRows[i].ChannelName = channelNameByID[channelRows[i].ChannelID]
	}

	errorQuery, err := applyUsageRankingFilters(LOG_DB.Table("logs"), query, LogTypeError)
	if err != nil {
		return result, err
	}
	errorQuery = applyUsageRankingUserScope(errorQuery, users)
	var errorRows []usageRankingErrorRow
	if err = errorQuery.Select("user_id, username, " + logGroupCol + " AS " + logGroupCol + ", COUNT(*) AS error_count").
		Group("user_id, username, " + logGroupCol).
		Scan(&errorRows).Error; err != nil {
		return result, err
	}

	userErrors := make(map[usageRankingIdentity]int64, len(users))
	groupErrors := make(map[usageRankingGroupIdentity]int64, len(errorRows))
	for _, row := range errorRows {
		identity := usageRankingIdentity{UserID: row.UserID, Username: row.Username}
		userErrors[identity] += row.ErrorCount
		groupErrors[usageRankingGroupIdentity{UserID: row.UserID, Username: row.Username, Group: row.Group}] = row.ErrorCount
	}

	groupQuota := make(map[usageRankingGroupIdentity]int64, len(groupRows))
	for _, row := range groupRows {
		groupQuota[usageRankingGroupIdentity{UserID: row.UserID, Username: row.Username, Group: row.Group}] = row.Quota
	}
	modelStats := make(map[usageRankingGroupIdentity][]UsageRankingModelStat, len(groupRows))
	for i := range modelRows {
		identity := usageRankingGroupIdentity{UserID: modelRows[i].UserID, Username: modelRows[i].Username, Group: modelRows[i].Group}
		if groupQuota[identity] > 0 {
			modelRows[i].QuotaRatio = float64(modelRows[i].Quota) / float64(groupQuota[identity])
		}
		modelStats[identity] = append(modelStats[identity], modelRows[i])
	}
	channelStats := make(map[usageRankingGroupIdentity][]UsageRankingChannelStat, len(groupRows))
	for i := range channelRows {
		identity := usageRankingGroupIdentity{UserID: channelRows[i].UserID, Username: channelRows[i].Username, Group: channelRows[i].Group}
		if groupQuota[identity] > 0 {
			channelRows[i].QuotaRatio = float64(channelRows[i].Quota) / float64(groupQuota[identity])
		}
		channelStats[identity] = append(channelStats[identity], channelRows[i])
	}

	groupStats := make(map[usageRankingIdentity][]UsageRankingGroupStat, len(users))
	for i := range groupRows {
		identity := usageRankingIdentity{UserID: groupRows[i].UserID, Username: groupRows[i].Username}
		groupIdentity := usageRankingGroupIdentity{UserID: groupRows[i].UserID, Username: groupRows[i].Username, Group: groupRows[i].Group}
		groupRows[i].ErrorCount = groupErrors[groupIdentity]
		groupRows[i].ModelStats = []UsageRankingModelStat{}
		groupRows[i].ChannelStats = []UsageRankingChannelStat{}
		if stats, ok := modelStats[groupIdentity]; ok {
			groupRows[i].ModelStats = stats
		}
		if stats, ok := channelStats[groupIdentity]; ok {
			groupRows[i].ChannelStats = stats
		}
		if groupRows[i].RequestCount > 0 {
			groupRows[i].StreamRatio = float64(groupRows[i].StreamCount) / float64(groupRows[i].RequestCount)
		}
		groupTotal := groupRows[i].RequestCount + groupRows[i].ErrorCount
		if groupTotal > 0 {
			groupRows[i].ErrorRate = float64(groupRows[i].ErrorCount) / float64(groupTotal)
		}
		groupStats[identity] = append(groupStats[identity], groupRows[i])
	}

	for i := range result.Items {
		identity := usageRankingIdentity{UserID: result.Items[i].UserID, Username: result.Items[i].Username}
		result.Items[i].ErrorCount = userErrors[identity]
		if result.Items[i].RequestCount > 0 {
			result.Items[i].StreamRatio = float64(result.Items[i].StreamCount) / float64(result.Items[i].RequestCount)
		}
		total := result.Items[i].RequestCount + result.Items[i].ErrorCount
		if total > 0 {
			result.Items[i].ErrorRate = float64(result.Items[i].ErrorCount) / float64(total)
		}
		if stats, ok := groupStats[identity]; ok {
			result.Items[i].GroupStats = stats
		}
	}

	return result, nil
}
