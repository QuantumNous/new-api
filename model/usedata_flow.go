package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
)

type FlowQuotaData struct {
	UserID           int    `json:"user_id" gorm:"column:user_id"`
	Username         string `json:"username" gorm:"column:username"`
	UserGroup        string `json:"user_group" gorm:"column:user_group"`
	TokenID          int    `json:"token_id" gorm:"column:token_id"`
	TokenName        string `json:"token_name" gorm:"column:token_name"`
	ChannelID        int    `json:"channel_id" gorm:"column:channel_id"`
	ChannelName      string `json:"channel_name" gorm:"-"`
	ModelName        string `json:"model_name" gorm:"column:model_name"`
	TokenUsed        int    `json:"token_used" gorm:"column:token_used"`
	InputTokens      int    `json:"input_tokens" gorm:"column:input_tokens"`
	Count            int    `json:"count" gorm:"column:count"`
	Quota            int    `json:"quota" gorm:"column:quota"`
	PromptTokens     int    `json:"prompt_tokens" gorm:"column:prompt_tokens"`
	CompletionTokens int    `json:"completion_tokens" gorm:"column:completion_tokens"`
	CacheTokens      int    `json:"cache_tokens" gorm:"column:cache_tokens"`
	CacheWriteTokens int    `json:"cache_write_tokens" gorm:"column:cache_write_tokens"`
}

func GetFlowQuotaData(startTime int64, endTime int64, username string, userID int) ([]*FlowQuotaData, error) {
	groupCol := "logs." + logGroupCol
	cacheTokensExpr := flowLogJSONNumberExpr("cache_tokens")
	cacheWriteTokensExpr := flowLogCacheWriteTokensExpr()
	inputTokensExpr := flowLogInputTokensExpr(cacheTokensExpr, cacheWriteTokensExpr)
	rows := make([]*FlowQuotaData, 0)
	query := LOG_DB.Table("logs").
		Select(
			"logs.user_id, logs.username, logs.token_id, logs.token_name, logs.channel_id, logs.model_name, "+
				groupCol+" AS user_group, "+
				"COUNT(*) AS count, "+
				"COALESCE(SUM(logs.quota), 0) AS quota, "+
				"COALESCE(SUM(logs.prompt_tokens), 0) AS prompt_tokens, "+
				"COALESCE(SUM("+inputTokensExpr+"), 0) AS input_tokens, "+
				"COALESCE(SUM(logs.completion_tokens), 0) AS completion_tokens, "+
				"COALESCE(SUM("+cacheTokensExpr+"), 0) AS cache_tokens, "+
				"COALESCE(SUM("+cacheWriteTokensExpr+"), 0) AS cache_write_tokens",
		).
		Where("logs.type = ?", LogTypeConsume)

	if startTime > 0 {
		query = query.Where("logs.created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("logs.created_at <= ?", endTime)
	}
	if username != "" {
		query = query.Where("logs.username = ?", username)
	}
	if userID > 0 {
		query = query.Where("logs.user_id = ?", userID)
	}

	err := query.
		Group("logs.user_id, logs.username, logs.token_id, logs.token_name, logs.channel_id, logs.model_name, " + groupCol).
		Order("quota DESC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		row.TokenUsed = row.InputTokens + row.CompletionTokens
	}
	if err := fillFlowChannelNames(rows); err != nil {
		return rows, err
	}
	return rows, nil
}

func flowLogJSONValidGuard() string {
	if common.UsingPostgreSQL {
		return "COALESCE(logs.other, '') <> ''"
	}
	if common.UsingMySQL {
		return "COALESCE(logs.other, '') <> '' AND JSON_VALID(logs.other)"
	}
	return "COALESCE(logs.other, '') <> '' AND json_valid(logs.other)"
}

func flowLogJSONNumberExpr(key string) string {
	guard := flowLogJSONValidGuard()
	if common.UsingPostgreSQL {
		return fmt.Sprintf(
			"(CASE WHEN %s THEN COALESCE(NULLIF(logs.other::jsonb ->> '%s', '')::integer, 0) ELSE 0 END)",
			guard,
			key,
		)
	}
	if common.UsingMySQL {
		return fmt.Sprintf(
			"(CASE WHEN %s THEN COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(logs.other, '$.%s')) AS SIGNED), 0) ELSE 0 END)",
			guard,
			key,
		)
	}
	return fmt.Sprintf(
		"(CASE WHEN %s THEN COALESCE(CAST(json_extract(logs.other, '$.%s') AS INTEGER), 0) ELSE 0 END)",
		guard,
		key,
	)
}

func flowLogJSONStringExpr(key string) string {
	guard := flowLogJSONValidGuard()
	if common.UsingPostgreSQL {
		return fmt.Sprintf(
			"(CASE WHEN %s THEN COALESCE(logs.other::jsonb ->> '%s', '') ELSE '' END)",
			guard,
			key,
		)
	}
	if common.UsingMySQL {
		return fmt.Sprintf(
			"(CASE WHEN %s THEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(logs.other, '$.%s')), '') ELSE '' END)",
			guard,
			key,
		)
	}
	return fmt.Sprintf(
		"(CASE WHEN %s THEN COALESCE(json_extract(logs.other, '$.%s'), '') ELSE '' END)",
		guard,
		key,
	)
}

func flowLogCacheWriteTokensExpr() string {
	cacheWriteTokens := flowLogJSONNumberExpr("cache_write_tokens")
	cacheCreationTokens := flowLogJSONNumberExpr("cache_creation_tokens")
	cacheCreation5mTokens := flowLogJSONNumberExpr("cache_creation_tokens_5m")
	cacheCreation1hTokens := flowLogJSONNumberExpr("cache_creation_tokens_1h")
	splitCacheCreationTokens := fmt.Sprintf("(%s + %s)", cacheCreation5mTokens, cacheCreation1hTokens)
	return fmt.Sprintf(
		"(CASE WHEN %s > 0 THEN %s WHEN %s > 0 THEN %s ELSE %s END)",
		cacheWriteTokens,
		cacheWriteTokens,
		splitCacheCreationTokens,
		splitCacheCreationTokens,
		cacheCreationTokens,
	)
}

func flowLogInputTokensExpr(cacheTokensExpr string, cacheWriteTokensExpr string) string {
	usageSemanticExpr := flowLogJSONStringExpr("usage_semantic")
	nonCacheInputExpr := fmt.Sprintf("(logs.prompt_tokens - %s - %s)", cacheTokensExpr, cacheWriteTokensExpr)
	return fmt.Sprintf(
		"(CASE WHEN %s = 'anthropic' THEN logs.prompt_tokens WHEN %s > 0 THEN %s ELSE 0 END)",
		usageSemanticExpr,
		nonCacheInputExpr,
		nonCacheInputExpr,
	)
}

func fillFlowChannelNames(rows []*FlowQuotaData) error {
	channelIDSet := make(map[int]struct{})
	channelIDs := make([]int, 0)
	for _, row := range rows {
		if row.ChannelID == 0 {
			continue
		}
		if _, ok := channelIDSet[row.ChannelID]; ok {
			continue
		}
		channelIDSet[row.ChannelID] = struct{}{}
		channelIDs = append(channelIDs, row.ChannelID)
	}
	if len(channelIDs) == 0 {
		return nil
	}

	var channels []struct {
		Id   int    `gorm:"column:id"`
		Name string `gorm:"column:name"`
	}
	if err := DB.Table("channels").Select("id, name").Where("id IN ?", channelIDs).Find(&channels).Error; err != nil {
		return err
	}
	channelNameByID := make(map[int]string, len(channels))
	for _, channel := range channels {
		channelNameByID[channel.Id] = channel.Name
	}
	for _, row := range rows {
		if name := channelNameByID[row.ChannelID]; name != "" {
			row.ChannelName = name
			continue
		}
		if row.ChannelID > 0 {
			row.ChannelName = fmt.Sprintf("channel-%d", row.ChannelID)
		}
	}
	return nil
}
