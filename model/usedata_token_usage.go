package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
)

// TokenUsageRow is one key's aggregated spend over a time range. Quota is the
// billing unit the rest of the dashboard reports (quota_per_unit per dollar),
// so the frontend formats it with the same formatter as the stat cards.
type TokenUsageRow struct {
	TokenID   int    `json:"token_id"`
	TokenName string `json:"token_name"`
	UserID    int    `json:"user_id"`
	Username  string `json:"username"`
	Count     int64  `json:"count"`
	Quota     int64  `json:"quota"`
	// RawQuota is the sticker price before the key's group discount/markup —
	// what the same requests would have cost at group ratio 1.0. Summed from
	// rows where it is known; rows written before the column existed
	// contribute 0, so RawQuota can read slightly low for very old data
	// mixed into the range. RawQuota is 0 for a row whenever none of its
	// underlying requests recorded a group ratio, which the frontend must
	// treat as "no discount data" rather than "no discount applied".
	RawQuota         int64 `json:"raw_quota"`
	TokenUsed        int64 `json:"token_used"`
	CacheReadTokens  int64 `json:"cache_read_tokens"`
	InputTokensTotal int64 `json:"input_tokens_total"`
	LastUsed         int64 `json:"last_used"`
}

// tokenUsageMaxRows caps the ranking payload. A deployment with thousands of
// keys still answers with the top spenders, which is what the card renders.
const tokenUsageMaxRows = 500

// GetTokenUsageRanking aggregates quota_data spend per key, busiest wallet
// first. userId > 0 scopes the ranking to one account (the self view); 0
// means admin across all users. token_name/model_name narrow it the same way
// the dashboard's other queries do.
//
// Rows are grouped by (token_id, user_id) without any join, so a one-to-many
// join cannot inflate the sums. Names resolve afterwards: the tokens table
// first (soft-deleted keys keep their name), then the pre-aggregated
// dimension table for ids whose token row was hard-deleted — their quota
// rows outlive the token, and the dimension table is the last place the
// id→name mapping survives. Rows without a token id cannot be attributed to
// a key and are not part of a per-key ranking.
func GetTokenUsageRanking(startTime int64, endTime int64, userId int, username string, tokenName string, modelName string, limit int) ([]TokenUsageRow, error) {
	if limit <= 0 || limit > tokenUsageMaxRows {
		limit = tokenUsageMaxRows
	}
	tx := DB.Table("quota_data").
		Select("token_id, user_id, max(username) as username, sum(count) as count, sum(quota) as quota, sum(raw_quota) as raw_quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(input_tokens_total) as input_tokens_total, max(created_at) as last_used").
		Where("token_id > 0 AND created_at >= ? AND created_at <= ?", startTime, endTime)
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_id IN (?)",
			DB.Table("tokens").Select("id").Where("name = ? AND deleted_at IS NULL", tokenName),
		)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	rows := make([]TokenUsageRow, 0, 64)
	if err := tx.Group("token_id, user_id").Order("quota DESC").Limit(limit).Scan(&rows).Error; err != nil {
		return nil, err
	}
	resolveTokenUsageNames(rows)
	return rows, nil
}

// resolveTokenUsageNames fills in display names for the ranked keys.
func resolveTokenUsageNames(rows []TokenUsageRow) {
	if len(rows) == 0 {
		return
	}
	ids := make([]int, 0, len(rows))
	for i := range rows {
		ids = append(ids, rows[i].TokenID)
	}
	names := make(map[int]string, len(rows))
	tokenRows := []struct {
		Id   int
		Name string
	}{}
	if err := DB.Table("tokens").Select("id, name").Where("id IN ?", ids).Scan(&tokenRows).Error; err != nil {
		common.SysLog(fmt.Sprintf("token usage name lookup failed: %s", err))
		return
	}
	for _, row := range tokenRows {
		names[row.Id] = row.Name
	}
	missing := make([]int, 0, len(rows))
	for i := range rows {
		if name := names[rows[i].TokenID]; name != "" {
			rows[i].TokenName = name
		} else {
			missing = append(missing, rows[i].TokenID)
		}
	}
	if len(missing) == 0 {
		return
	}
	dimRows := []struct {
		TokenNameId int
		TokenName   string
	}{}
	if err := DB.Table("quota_data_dimensions").
		Select("DISTINCT token_name_id, token_name").
		Where("token_name_id IN ?", missing).
		Scan(&dimRows).Error; err != nil {
		return
	}
	for _, dim := range dimRows {
		if dim.TokenName == "" {
			continue
		}
		for i := range rows {
			if rows[i].TokenID == dim.TokenNameId && rows[i].TokenName == "" {
				rows[i].TokenName = dim.TokenName
			}
		}
	}
}
