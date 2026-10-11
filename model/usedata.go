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
	// CacheReadTokens / InputTokensTotal accumulate cache billing counters so the
	// dashboard can derive a cache hit rate. Both stay zero for rows written
	// before these columns existed, and InputTokensTotal only accumulates for
	// requests whose upstream actually reported cache metadata, so the ratio
	// never counts a missing cache field as a miss.
	CacheReadTokens  int `json:"cache_read_tokens" gorm:"default:0"`
	InputTokensTotal int `json:"input_tokens_total" gorm:"default:0"`
}

type QuotaDataLogParams struct {
	UserID           int
	Username         string
	ModelName        string
	Quota            int
	CreatedAt        int64
	TokenUsed        int
	UseGroup         string
	TokenID          int
	ChannelID        int
	NodeName         string
	CacheReadTokens  int
	InputTokensTotal int
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
	tokenUsed := quotaData.TokenUsed
	cacheReadTokens := quotaData.CacheReadTokens
	inputTokensTotal := quotaData.InputTokensTotal
	cachedQuotaData, ok := CacheQuotaData[key]
	if ok {
		cachedQuotaData.Count += count
		cachedQuotaData.Quota += quota
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
	}
	CacheQuotaData = make(map[string]*QuotaData)
	common.SysLog(fmt.Sprintf("保存数据看板数据成功，共保存%d条数据", size))
}

func increaseQuotaData(quotaData *QuotaData) {
	err := DB.Table("quota_data").
		Where("user_id = ? and username = ? and model_name = ? and created_at = ? and use_group = ? and token_id = ? and channel_id = ? and node_name = ?",
			quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt, quotaData.UseGroup, quotaData.TokenID, quotaData.ChannelID, quotaData.NodeName).
		Updates(map[string]interface{}{
			"count":              gorm.Expr("count + ?", quotaData.Count),
			"quota":              gorm.Expr("quota + ?", quotaData.Quota),
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
// simply match nothing.
func quotaDataTokenNameJoin(tx *gorm.DB, tokenName string) *gorm.DB {
	if tokenName == "" {
		return tx
	}
	return tx.Where("token_id IN (?)",
		DB.Table("tokens").Select("id").Where("name = ?", tokenName),
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
