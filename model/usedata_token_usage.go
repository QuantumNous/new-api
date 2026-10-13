package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
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
	RawQuota int64 `json:"raw_quota"`
	// ChargeUSDMicros sums each underlying request's own real USD settlement
	// (micros = millionths of a dollar), already computed by the billing path
	// and frozen into the log. This is the number to show as "$" — it is not
	// derived from Quota, which is in an internal unit that bakes in a CNY
	// rate that can drift over the range. 0 means unknown, the same
	// convention as RawQuota, for rows predating this column.
	ChargeUSDMicros int64 `json:"charge_usd_micros"`
	// ChargeCNYMicros is ChargeUSDMicros converted at the admin-configured
	// billing exchange rate (operation_setting.GetBillingUSDToCNYRate, same
	// setting the relay path itself uses) — not the exact per-request rate,
	// which isn't carried in this aggregate, but the live configured rate
	// rather than a hardcoded constant.
	ChargeCNYMicros int64 `json:"charge_cny_micros"`
	// RawChargeUSDMicros / RawChargeCNYMicros are the sticker-price USD/CNY —
	// what the paid charge would be at group ratio 1.0, scaled from
	// ChargeUSDMicros by the same RawQuota/Quota ratio already used for the
	// quota column, so the two "before discount" figures stay consistent
	// with each other. 0 when Quota is 0 (nothing to scale from).
	RawChargeUSDMicros int64 `json:"raw_charge_usd_micros"`
	RawChargeCNYMicros int64 `json:"raw_charge_cny_micros"`
	TokenUsed          int64 `json:"token_used"`
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
	// quota_data.created_at is always floor(ts/3600)*3600 (the hour-bucket start).
	// A rolling window such as "now-3600" starts mid-hour and would exclude that
	// hour's completed bucket entirely. Floor startTime to the same boundary so
	// the bucket containing startTime is always included.
	startTime = startTime - (startTime % 3600)
	tx := DB.Table("quota_data").
		Select("token_id, user_id, max(username) as username, sum(count) as count, sum(quota) as quota, sum(raw_quota) as raw_quota, sum(charge_usd_micros) as charge_usd_micros, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(input_tokens_total) as input_tokens_total, max(created_at) as last_used").
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
	fillTokenUsageMoneyFields(rows)
	return rows, nil
}

// usdToCNYRate reads the admin-configured billing exchange rate (系统设置 ->
// 货币与展示 -> 计费汇率), the same value the relay path itself uses to turn
// USD cost into CNY quota. Falls back to 1 the same way GetBillingUSDToCNYRate
// does when unset/invalid — this is a display conversion, not the exact
// per-request rate (which can differ if the admin changes the setting over
// the range), but it is the live rate rather than a hardcoded guess.
func usdToCNYRate() float64 {
	return operation_setting.GetBillingUSDToCNYRate()
}

// fillTokenUsageMoneyFields derives the CNY and before-discount money fields
// from what the query already summed, so callers get ready-to-use numbers
// instead of redoing this arithmetic client-side.
func fillTokenUsageMoneyFields(rows []TokenUsageRow) {
	rate := usdToCNYRate()
	for i := range rows {
		row := &rows[i]
		row.ChargeCNYMicros = int64(float64(row.ChargeUSDMicros)*rate + 0.5)
		if row.Quota <= 0 {
			continue
		}
		row.RawChargeUSDMicros = int64(float64(row.ChargeUSDMicros)*float64(row.RawQuota)/float64(row.Quota) + 0.5)
		row.RawChargeCNYMicros = int64(float64(row.RawChargeUSDMicros)*rate + 0.5)
	}
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
