package model

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// QuotaData 柱状图数据
type QuotaData struct {
	Id        int    `json:"id"`
	UserID    int    `json:"user_id" gorm:"index"`
	Username  string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;size:64;default:''"`
	ModelName string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;size:64;default:''"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2"`
	UseGroup  string `json:"use_group" gorm:"index;size:64;default:''"`
	TokenID   int    `json:"token_id" gorm:"index;default:0"`
	ChannelID int    `json:"channel_id" gorm:"index;default:0"`
	NodeName  string `json:"node_name" gorm:"index;size:64;default:''"`
	TokenUsed int    `json:"token_used" gorm:"default:0"`
	Count     int    `json:"count" gorm:"default:0"`
	Quota     int    `json:"quota" gorm:"default:0"`
	// RawQuota is what the same requests would have cost at group ratio 1.0 —
	// the "sticker price" before the caller's group discount/markup. It is
	// derived once at write time as Quota / GroupRatio and summed alongside
	// Quota, so a caller can read "paid vs. list price" straight off the
	// aggregate without re-deriving a ratio from individually-weighted rows
	// (group ratio is not itself meaningfully summable across a batch).
	// Rows written before this column existed have RawQuota 0; readers must
	// treat 0 as "unknown", not "free", the same way the cache counters do.
	RawQuota int `json:"raw_quota" gorm:"default:0"`
	// ChargeUSDMicros is the sum of each request's own real USD settlement
	// snapshot (cost_reconciliation.user_charge_usd_micros, already written
	// into every consume log). It is read back here rather than re-derived
	// from Quota, because Quota is in an internal unit that bakes in a CNY
	// exchange rate that can change over time — summing raw quota and
	// dividing by one rate afterwards would silently misprice any row whose
	// rate differed from today's. 0 means unknown for rows predating this
	// column, the same convention as RawQuota.
	ChargeUSDMicros int64 `json:"charge_usd_micros" gorm:"default:0"`
	// CacheReadTokens / InputTokensTotal accumulate cache billing counters so the
	// dashboard can derive a cache hit rate. Both stay zero for rows written
	// before these columns existed, and InputTokensTotal only accumulates for
	// requests whose upstream actually reported cache metadata, so the ratio
	// never counts a missing cache field as a miss.
	CacheReadTokens  int `json:"cache_read_tokens" gorm:"default:0"`
	InputTokensTotal int `json:"input_tokens_total" gorm:"default:0"`
}

type QuotaDataLogParams struct {
	UserID    int
	Username  string
	ModelName string
	Quota     int
	CreatedAt int64
	TokenUsed int
	UseGroup  string
	TokenID   int
	ChannelID int
	NodeName  string
	// GroupRatio is the discount/markup factor already baked into Quota. 0
	// means "unknown" (e.g. a billing path that never computed one), in which
	// case LogQuotaData leaves RawQuota at 0 rather than guessing a ratio.
	GroupRatio float64
	// ChargeUSDMicros is this one request's real USD settlement, already
	// computed by the billing path and read back from the log here. 0 means
	// unknown, never "free".
	ChargeUSDMicros  int64
	CacheReadTokens  int
	InputTokensTotal int
}

// rawQuotaFromGroupRatio derives the pre-discount quota for one entry.
// ratio <= 0 means the caller never computed one (e.g. task billing paths
// that bill a fixed Quota directly) — in that case the raw quota is reported
// as unknown (0) instead of silently assuming no discount applied.
func rawQuotaFromGroupRatio(quota int, ratio float64) int {
	if ratio <= 0 {
		return 0
	}
	return int(float64(quota)/ratio + 0.5)
}

// QuotaDataDimension is one pre-aggregated (user, key, model) triple that has
// consumption. The dashboard's quick-filter dropdowns read this small table
// instead of running DISTINCT scans over quota_data, which is what made the
// dashboard time out on large datasets. It is maintained incrementally by
// SaveQuotaDataCache and backfilled from history on startup/migration.
type QuotaDataDimension struct {
	ID          int    `json:"id" gorm:"primaryKey"`
	UserID      int    `json:"user_id" gorm:"uniqueIndex:idx_qdd_user_key_model,priority:1"`
	TokenName   string `json:"token_name" gorm:"uniqueIndex:idx_qdd_user_key_model,priority:2;size:64;default:''"`
	ModelName   string `json:"model_name" gorm:"uniqueIndex:idx_qdd_user_key_model,priority:3;size:64;default:''"`
	LastSeenAt  int64  `json:"last_seen_at" gorm:"bigint"`
	TokenNameID int    `json:"token_id" gorm:"index;default:0"`
}

func UpdateQuotaData() {
	for {
		if common.DataExportEnabled {
			common.SysLog("正在更新数据看板数据...")
			SaveQuotaDataCache()
		}
		time.Sleep(time.Duration(common.DataExportInterval) * time.Minute)
	}
}

var CacheQuotaData = make(map[string]*QuotaData)
var CacheQuotaDataLock = sync.Mutex{}

func logQuotaDataCache(quotaData *QuotaData) {
	key := fmt.Sprintf("%d\x00%s\x00%s\x00%d\x00%s\x00%d\x00%d\x00%s",
		quotaData.UserID,
		quotaData.Username,
		quotaData.ModelName,
		quotaData.CreatedAt,
		quotaData.UseGroup,
		quotaData.TokenID,
		quotaData.ChannelID,
		quotaData.NodeName,
	)
	count := quotaData.Count
	quota := quotaData.Quota
	rawQuota := quotaData.RawQuota
	chargeUSDMicros := quotaData.ChargeUSDMicros
	tokenUsed := quotaData.TokenUsed
	cacheReadTokens := quotaData.CacheReadTokens
	inputTokensTotal := quotaData.InputTokensTotal
	cachedQuotaData, ok := CacheQuotaData[key]
	if ok {
		cachedQuotaData.Count += count
		cachedQuotaData.Quota += quota
		cachedQuotaData.RawQuota += rawQuota
		cachedQuotaData.ChargeUSDMicros += chargeUSDMicros
		cachedQuotaData.TokenUsed += tokenUsed
		cachedQuotaData.CacheReadTokens += cacheReadTokens
		cachedQuotaData.InputTokensTotal += inputTokensTotal
		quotaData = cachedQuotaData
	}
	CacheQuotaData[key] = quotaData
}

func LogQuotaData(params QuotaDataLogParams) {
	// 只精确到小时
	createdAt := params.CreatedAt - (params.CreatedAt % 3600)
	quotaData := &QuotaData{
		UserID:           params.UserID,
		Username:         params.Username,
		ModelName:        params.ModelName,
		CreatedAt:        createdAt,
		UseGroup:         params.UseGroup,
		TokenID:          params.TokenID,
		ChannelID:        params.ChannelID,
		NodeName:         params.NodeName,
		Count:            1,
		Quota:            params.Quota,
		RawQuota:         rawQuotaFromGroupRatio(params.Quota, params.GroupRatio),
		ChargeUSDMicros:  params.ChargeUSDMicros,
		TokenUsed:        params.TokenUsed,
		CacheReadTokens:  params.CacheReadTokens,
		InputTokensTotal: params.InputTokensTotal,
	}

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(quotaData)
}

func SaveQuotaDataCache() {
	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	size := len(CacheQuotaData)
	// 如果缓存中有数据，就保存到数据库中
	// 1. 先查询数据库中是否有数据
	// 2. 如果有数据，就更新数据
	// 3. 如果没有数据，就插入数据
	for _, quotaData := range CacheQuotaData {
		quotaDataDB := &QuotaData{}
		DB.Table("quota_data").
			Where("user_id = ? and username = ? and model_name = ? and created_at = ? and use_group = ? and token_id = ? and channel_id = ? and node_name = ?",
				quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt, quotaData.UseGroup, quotaData.TokenID, quotaData.ChannelID, quotaData.NodeName).
			First(quotaDataDB)
		if quotaDataDB.Id > 0 {
			//quotaDataDB.Count += quotaData.Count
			//quotaDataDB.Quota += quotaData.Quota
			//DB.Table("quota_data").Save(quotaDataDB)
			increaseQuotaData(quotaData)
		} else {
			DB.Table("quota_data").Create(quotaData)
		}
		upsertQuotaDataDimension(quotaData)
	}
	CacheQuotaData = make(map[string]*QuotaData)
	common.SysLog(fmt.Sprintf("保存数据看板数据成功，共保存%d条数据", size))
}

// upsertQuotaDataDimension keeps the pre-aggregated dimension table in sync
// with the flushed quota_data rows. A token's display name is resolved once
// per flush here (not per dropdown read); unknown token ids are stored with
// an empty name and refreshed by the next backfill after the token appears.
func upsertQuotaDataDimension(quotaData *QuotaData) {
	tokenName := ""
	if quotaData.TokenID != 0 {
		token := &Token{}
		if err := DB.Select("name").Where("id = ?", quotaData.TokenID).First(token).Error; err == nil {
			tokenName = token.Name
		}
	}
	now := time.Now().Unix()
	var existing QuotaDataDimension
	err := DB.Where("user_id = ? AND token_name = ? AND model_name = ?",
		quotaData.UserID, tokenName, quotaData.ModelName).First(&existing).Error
	if err == nil {
		if existing.LastSeenAt < now {
			DB.Model(&existing).Update("last_seen_at", now)
		}
		return
	}
	DB.Create(&QuotaDataDimension{
		UserID:      quotaData.UserID,
		TokenName:   tokenName,
		ModelName:   quotaData.ModelName,
		LastSeenAt:  now,
		TokenNameID: quotaData.TokenID,
	})
}

// BackfillQuotaDataDimensions rebuilds the dimension table from historical
// quota_data rows. It is idempotent: existing triples keep their newest
// last_seen_at, new ones are inserted. Intended for startup/migration, where
// the table may be missing rows written before this table existed.
func BackfillQuotaDataDimensions() (int64, error) {
	res := DB.Exec(`
INSERT INTO quota_data_dimensions (user_id, token_name, model_name, last_seen_at, token_name_id)
SELECT q.user_id, COALESCE(t.name, ''), q.model_name, MAX(q.created_at), MAX(q.token_id)
FROM quota_data q
LEFT JOIN tokens t ON t.id = q.token_id
WHERE q.token_id > 0
GROUP BY q.user_id, COALESCE(t.name, ''), q.model_name
ON CONFLICT (user_id, token_name, model_name)
DO UPDATE SET last_seen_at = GREATEST(quota_data_dimensions.last_seen_at, EXCLUDED.last_seen_at)
`)
	return res.RowsAffected, res.Error
}

// GetQuotaDataDimensionsFast reads the pre-aggregated table. user_id=0 means
// all users (admin view). The time-range parameters of the old live-scan API
// are intentionally gone: the table represents dimensions that have any
// consumption, which is what the pickers want.
func GetQuotaDataDimensionsFast(userId int) (dims QuotaDataDimensions, err error) {
	tokenNames := []string{}
	// Only keys that currently exist and are active are offered in the
	// pickers: disabled/expired/exhausted keys stay in the data but drop out
	// of the lists, and so do soft-deleted ones — status stays 1 on deletion,
	// so the deleted_at check below is what actually removes them.
	// Columns must be table-qualified: the JOIN below brings tokens.user_id
	// into scope, and a bare user_id is an ambiguous reference on Postgres
	// (SQLSTATE 42702), which broke the per-user pickers entirely. The raw
	// JOIN also bypasses GORM's soft-delete scope, hence the explicit
	// deleted_at condition.
	tx := DB.Table("quota_data_dimensions").
		Select("DISTINCT quota_data_dimensions.token_name").
		Joins("JOIN tokens ON tokens.id = quota_data_dimensions.token_name_id AND tokens.status = 1 AND tokens.deleted_at IS NULL AND tokens.name = quota_data_dimensions.token_name")
	if userId != 0 {
		tx = tx.Where("quota_data_dimensions.user_id = ?", userId)
	}
	if err = tx.Where("quota_data_dimensions.token_name != ''").Order("quota_data_dimensions.token_name").Pluck("quota_data_dimensions.token_name", &tokenNames).Error; err != nil {
		return dims, err
	}
	dims.Keys = tokenNames

	modelTx := DB.Table("quota_data_dimensions").Select("DISTINCT model_name")
	if userId != 0 {
		modelTx = modelTx.Where("user_id = ?", userId)
	}
	models := []string{}
	if err = modelTx.Where("model_name != ''").Order("model_name").Pluck("model_name", &models).Error; err != nil {
		return dims, err
	}
	dims.Models = models
	return dims, nil
}

func increaseQuotaData(quotaData *QuotaData) {
	err := DB.Table("quota_data").
		Where("user_id = ? and username = ? and model_name = ? and created_at = ? and use_group = ? and token_id = ? and channel_id = ? and node_name = ?",
			quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt, quotaData.UseGroup, quotaData.TokenID, quotaData.ChannelID, quotaData.NodeName).
		Updates(map[string]interface{}{
			"count":              gorm.Expr("count + ?", quotaData.Count),
			"quota":              gorm.Expr("quota + ?", quotaData.Quota),
			"raw_quota":          gorm.Expr("raw_quota + ?", quotaData.RawQuota),
			"charge_usd_micros":  gorm.Expr("charge_usd_micros + ?", quotaData.ChargeUSDMicros),
			"token_used":         gorm.Expr("token_used + ?", quotaData.TokenUsed),
			"cache_read_tokens":  gorm.Expr("cache_read_tokens + ?", quotaData.CacheReadTokens),
			"input_tokens_total": gorm.Expr("input_tokens_total + ?", quotaData.InputTokensTotal),
		}).Error
	if err != nil {
		common.SysLog(fmt.Sprintf("increaseQuotaData error: %s", err))
	}
}

func GetQuotaDataByUsername(username string, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	err = DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(input_tokens_total) as input_tokens_total").
		Where("username = ? and created_at >= ? and created_at <= ?", username, startTime, endTime).
		Group("user_id, username, model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

// quotaDataTokenNameJoin narrows quota_data rows to tokens whose name matches
// the dashboard's key filter. quota_data stores token ids only, so the name is
// resolved through the tokens table at read time; unknown or renamed keys
// simply match nothing. Soft-deleted keys are excluded as well: the pickers no
// longer offer them, so filtering by hand-typed names must agree with that.
func quotaDataTokenNameJoin(tx *gorm.DB, tokenName string) *gorm.DB {
	if tokenName == "" {
		return tx
	}
	return tx.Where("token_id IN (?)",
		DB.Table("tokens").Select("id").Where("name = ? AND deleted_at IS NULL", tokenName),
	)
}

// quotaDataFilteredBy applies the dashboard's optional key-name and model
// name filters to a quota_data query. Both are exact matches, mirroring how
// the username filter behaves.
func quotaDataFilteredBy(tx *gorm.DB, tokenName string, modelName string) *gorm.DB {
	tx = quotaDataTokenNameJoin(tx, tokenName)
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	return tx
}

func GetQuotaDataByUserId(userId int, startTime int64, endTime int64, tokenName string, modelName string) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	tx := DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(input_tokens_total) as input_tokens_total").
		Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime).
		Group("user_id, username, model_name, created_at")
	tx = quotaDataFilteredBy(tx, tokenName, modelName)
	err = tx.Find(&quotaDatas).Error
	return quotaDatas, err
}

// GetQuotaDataByUserIds returns hourly quota data for a parent + children set.
func GetQuotaDataByUserIds(userIds []int, startTime int64, endTime int64, tokenName string, modelName string) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	tx := DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(input_tokens_total) as input_tokens_total").
		Where("user_id IN ? AND created_at >= ? AND created_at <= ?", userIds, startTime, endTime).
		Group("user_id, username, model_name, created_at")
	tx = quotaDataFilteredBy(tx, tokenName, modelName)
	err = tx.Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataGroupByUser(startTime int64, endTime int64, tokenName string, modelName string) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	tx := DB.Table("quota_data").
		Select("username, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Group("username, created_at")
	tx = quotaDataFilteredBy(tx, tokenName, modelName)
	err = tx.Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetAllQuotaDates(startTime int64, endTime int64, username string, tokenName string, modelName string) (quotaData []*QuotaData, err error) {
	if username != "" {
		var filtered []*QuotaData
		tx := DB.Table("quota_data").
			Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(input_tokens_total) as input_tokens_total").
			Where("username = ? and created_at >= ? and created_at <= ?", username, startTime, endTime).
			Group("user_id, username, model_name, created_at")
		tx = quotaDataFilteredBy(tx, tokenName, modelName)
		err = tx.Find(&filtered).Error
		return filtered, err
	}
	if tokenName != "" || modelName != "" {
		var filtered []*QuotaData
		tx := DB.Table("quota_data").
			Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(input_tokens_total) as input_tokens_total, created_at").
			Where("created_at >= ? and created_at <= ?", startTime, endTime).
			Group("model_name, created_at")
		tx = quotaDataFilteredBy(tx, tokenName, modelName)
		err = tx.Find(&filtered).Error
		return filtered, err
	}
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	// only select model_name, sum(count) as count, sum(quota) as quota, model_name, created_at from quota_data group by model_name, created_at;
	//err = DB.Table("quota_data").Where("created_at >= ? and created_at <= ?", startTime, endTime).Find(&quotaDatas).Error
	err = DB.Table("quota_data").Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(input_tokens_total) as input_tokens_total, created_at").Where("created_at >= ? and created_at <= ?", startTime, endTime).Group("model_name, created_at").Find(&quotaDatas).Error
	return quotaDatas, err
}

// QuotaDataDimensions lists the key names and models that actually have
// consumption rows in the window, for the dashboard's quick-filter dropdowns.
// Key names resolve from token ids the same way the name-filter query does,
// so renamed or deleted keys never reappear as stale options.
type QuotaDataDimensions struct {
	Keys   []string `json:"keys"`
	Models []string `json:"models"`
}

func GetQuotaDataDimensions(startTime int64, endTime int64, userId int) (dims QuotaDataDimensions, err error) {
	tokenIDs := []int{}
	idTx := DB.Table("quota_data").Select("DISTINCT token_id")
	if userId != 0 {
		idTx = idTx.Where("user_id = ?", userId)
	}
	if err = idTx.Where("created_at >= ? and created_at <= ?", startTime, endTime).Pluck("token_id", &tokenIDs).Error; err != nil {
		return dims, err
	}
	if len(tokenIDs) > 0 {
		tokenNames := []string{}
		if err = DB.Table("tokens").Where("id IN (?)", tokenIDs).Order("name").Pluck("name", &tokenNames).Error; err != nil {
			return dims, err
		}
		dims.Keys = tokenNames
	} else {
		dims.Keys = []string{}
	}

	modelTx := DB.Table("quota_data").Select("DISTINCT model_name").Order("model_name")
	if userId != 0 {
		modelTx = modelTx.Where("user_id = ?", userId)
	}
	models := []string{}
	if err = modelTx.Where("created_at >= ? and created_at <= ?", startTime, endTime).Pluck("model_name", &models).Error; err != nil {
		return dims, err
	}
	// The rollup writes an empty model_name for traffic it could not
	// attribute; such a blank entry is noise in a picker.
	filteredModels := make([]string, 0, len(models))
	for _, m := range models {
		if m != "" {
			filteredModels = append(filteredModels, m)
		}
	}
	dims.Models = filteredModels
	return dims, nil
}

// GetTeamUsageSummaryByBindings returns aggregate (used_quota, request_count)
// for a parent account's team:
//   - Parent's own used_quota and request_count (all time, from users table)
//   - Children's quota and count from quota_data, summed only for rows whose
//     created_at falls inside at least one binding window in user_parent_bindings
//
// This correctly excludes a child's usage from before it was bound, and any
// usage produced while it was unbound between two binding periods.
func GetTeamUsageSummaryByBindings(parentId int) (usedQuota int64, requestCount int64, err error) {
	// 1. Parent's own historical totals (stored on the user row).
	var parent User
	if err = DB.Select("used_quota, request_count").
		Where("id = ?", parentId).
		First(&parent).Error; err != nil {
		return 0, 0, err
	}

	// 2. Children's usage during binding periods, via quota_data JOIN.
	type childTotals struct {
		Quota int64
		Count int64
	}
	var ct childTotals
	err = DB.Table("quota_data").
		Select(
			"COALESCE(SUM(quota_data.quota), 0) AS quota, " +
				"COALESCE(SUM(quota_data.count), 0) AS count",
		).
		Joins(
			"JOIN user_parent_bindings upb"+
				" ON quota_data.user_id = upb.child_id"+
				" AND upb.parent_id = ?"+
				" AND quota_data.created_at >= upb.bound_at"+
				" AND (upb.unbound_at = 0 OR quota_data.created_at < upb.unbound_at)",
			parentId,
		).
		Scan(&ct).Error
	if err != nil {
		return 0, 0, err
	}

	return int64(parent.UsedQuota) + ct.Quota,
		int64(parent.RequestCount) + ct.Count,
		nil
}
