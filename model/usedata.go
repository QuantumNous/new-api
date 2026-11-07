package model

import (
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// QuotaData 柱状图数据
type QuotaData struct {
	Id                  int    `json:"id"`
	UserID              int    `json:"user_id" gorm:"index"`
	Username            string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;size:64;default:''"`
	ModelName           string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;size:64;default:''"`
	CreatedAt           int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2"`
	UseGroup            string `json:"use_group" gorm:"index;size:64;default:''"`
	TokenID             int    `json:"token_id" gorm:"index;default:0"`
	ChannelID           int    `json:"channel_id" gorm:"index;default:0"`
	NodeName            string `json:"node_name" gorm:"index;size:64;default:''"`
	TokenUsed           int    `json:"token_used" gorm:"default:0"`
	Count               int    `json:"count" gorm:"default:0"`
	Quota               int    `json:"quota" gorm:"default:0"`
	CacheReadTokens     int64  `json:"cache_read_tokens" gorm:"default:0"`
	CacheCreationTokens int64  `json:"cache_creation_tokens" gorm:"default:0"`
}

type QuotaDataLogParams struct {
	UserID              int
	Username            string
	ModelName           string
	Quota               int
	CreatedAt           int64
	TokenUsed           int
	CacheReadTokens     int64
	CacheCreationTokens int64
	UseGroup            string
	TokenID             int
	ChannelID           int
	NodeName            string
}

func UpdateQuotaData() {
	for {
		if common.DataExportEnabled {
			common.SysLog(common.LogText("updating dashboard data..."))
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
	cachedQuotaData, ok := CacheQuotaData[key]
	if ok {
		cachedQuotaData.Count += count
		cachedQuotaData.Quota += quota
		cachedQuotaData.TokenUsed += tokenUsed
		cachedQuotaData.CacheReadTokens += quotaData.CacheReadTokens
		cachedQuotaData.CacheCreationTokens += quotaData.CacheCreationTokens
		quotaData = cachedQuotaData
	}
	CacheQuotaData[key] = quotaData
}

func LogQuotaData(params QuotaDataLogParams) {
	// 只精确到小时
	createdAt := params.CreatedAt - (params.CreatedAt % 3600)
	quotaData := &QuotaData{
		UserID:              params.UserID,
		Username:            params.Username,
		ModelName:           params.ModelName,
		CreatedAt:           createdAt,
		UseGroup:            params.UseGroup,
		TokenID:             params.TokenID,
		ChannelID:           params.ChannelID,
		NodeName:            params.NodeName,
		Count:               1,
		Quota:               params.Quota,
		TokenUsed:           params.TokenUsed,
		CacheReadTokens:     max(0, params.CacheReadTokens),
		CacheCreationTokens: max(0, params.CacheCreationTokens),
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
	common.SysLog(common.LogText("saved dashboard data, %d records", size))
}

func increaseQuotaData(quotaData *QuotaData) {
	err := DB.Table("quota_data").
		Where("user_id = ? and username = ? and model_name = ? and created_at = ? and use_group = ? and token_id = ? and channel_id = ? and node_name = ?",
			quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt, quotaData.UseGroup, quotaData.TokenID, quotaData.ChannelID, quotaData.NodeName).
		Updates(map[string]any{
			"count":                 gorm.Expr("count + ?", quotaData.Count),
			"quota":                 gorm.Expr("quota + ?", quotaData.Quota),
			"token_used":            gorm.Expr("token_used + ?", quotaData.TokenUsed),
			"cache_read_tokens":     gorm.Expr("cache_read_tokens + ?", quotaData.CacheReadTokens),
			"cache_creation_tokens": gorm.Expr("cache_creation_tokens + ?", quotaData.CacheCreationTokens),
		}).Error
	if err != nil {
		common.SysLog(common.LogText("increaseQuotaData error: %s", err))
	}
}

// pendingQuotaDataSnapshot returns a deep copy of the in-memory quota data that
// has not been flushed to the database yet, restricted to the given hour range
// and to rows matching the optional predicate. Dashboard read paths merge this
// with persisted rows so the control panel reflects live traffic instead of
// waiting for the next DataExportInterval flush.
func pendingQuotaDataSnapshot(startTime int64, endTime int64, match func(*QuotaData) bool) []*QuotaData {
	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	if len(CacheQuotaData) == 0 {
		return nil
	}
	rows := make([]*QuotaData, 0, len(CacheQuotaData))
	for _, item := range CacheQuotaData {
		if item.CreatedAt < startTime || item.CreatedAt > endTime {
			continue
		}
		if match != nil && !match(item) {
			continue
		}
		snapshot := *item
		rows = append(rows, &snapshot)
	}
	return rows
}

// mergePendingQuotaData folds the in-memory snapshot into the aggregated rows
// already returned by the database, aggregating on groupKey so a pending entry
// joins its persisted counterpart instead of duplicating it. Newly created rows
// are projected to the same shape the database grouping would have produced.
func mergePendingQuotaData(dbRows []*QuotaData, pending []*QuotaData, groupKey func(*QuotaData) string, project func(*QuotaData)) []*QuotaData {
	if len(pending) == 0 {
		return dbRows
	}
	index := make(map[string]*QuotaData, len(dbRows))
	for _, row := range dbRows {
		index[groupKey(row)] = row
	}
	for _, item := range pending {
		key := groupKey(item)
		if existing, ok := index[key]; ok {
			existing.Count += item.Count
			existing.Quota += item.Quota
			existing.TokenUsed += item.TokenUsed
			existing.CacheReadTokens += item.CacheReadTokens
			existing.CacheCreationTokens += item.CacheCreationTokens
			continue
		}
		row := *item
		project(&row)
		index[key] = &row
		dbRows = append(dbRows, &row)
	}
	return dbRows
}

func quotaModelHourKey(row *QuotaData) string {
	return row.ModelName + "\x00" + strconv.FormatInt(row.CreatedAt, 10)
}

func quotaUsernameHourKey(row *QuotaData) string {
	return row.Username + "\x00" + strconv.FormatInt(row.CreatedAt, 10)
}

func quotaUserModelHourKey(row *QuotaData) string {
	return strconv.Itoa(row.UserID) + "\x00" + row.Username + "\x00" + row.ModelName + "\x00" + strconv.FormatInt(row.CreatedAt, 10)
}

// projectAllModelsRow matches the shape of a `quota_data` GROUP BY model_name,
// created_at row, which only carries the grouping columns and summed totals.
func projectAllModelsRow(row *QuotaData) {
	row.UserID = 0
	row.Username = ""
	row.UseGroup = ""
	row.TokenID = 0
	row.ChannelID = 0
	row.NodeName = ""
}

// projectUserModelRow matches a GROUP BY user_id, username, model_name,
// created_at row.
func projectUserModelRow(row *QuotaData) {
	row.UseGroup = ""
	row.TokenID = 0
	row.ChannelID = 0
	row.NodeName = ""
}

// projectUsernameRow matches a GROUP BY username, created_at row.
func projectUsernameRow(row *QuotaData) {
	row.UserID = 0
	row.ModelName = ""
	row.UseGroup = ""
	row.TokenID = 0
	row.ChannelID = 0
	row.NodeName = ""
}

func GetQuotaDataByUsername(username string, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	err = DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens").
		Where("username = ? and created_at >= ? and created_at <= ?", username, startTime, endTime).
		Group("user_id, username, model_name, created_at").
		Find(&quotaDatas).Error
	if err != nil {
		return nil, err
	}
	pending := pendingQuotaDataSnapshot(startTime, endTime, func(row *QuotaData) bool {
		return row.Username == username
	})
	return mergePendingQuotaData(quotaDatas, pending, quotaUserModelHourKey, projectUserModelRow), nil
}

func GetQuotaDataByUserId(userId int, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	err = DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens").
		Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime).
		Group("user_id, username, model_name, created_at").
		Find(&quotaDatas).Error
	if err != nil {
		return nil, err
	}
	pending := pendingQuotaDataSnapshot(startTime, endTime, func(row *QuotaData) bool {
		return row.UserID == userId
	})
	return mergePendingQuotaData(quotaDatas, pending, quotaUserModelHourKey, projectUserModelRow), nil
}

func GetQuotaDataGroupByUser(startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	err = DB.Table("quota_data").
		Select("username, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Group("username, created_at").
		Find(&quotaDatas).Error
	if err != nil {
		return nil, err
	}
	pending := pendingQuotaDataSnapshot(startTime, endTime, nil)
	return mergePendingQuotaData(quotaDatas, pending, quotaUsernameHourKey, projectUsernameRow), nil
}

func GetAllQuotaDates(startTime int64, endTime int64, username string) (quotaData []*QuotaData, err error) {
	if username != "" {
		return GetQuotaDataByUsername(username, startTime, endTime)
	}
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	// only select model_name, sum(count) as count, sum(quota) as quota, model_name, created_at from quota_data group by model_name, created_at;
	//err = DB.Table("quota_data").Where("created_at >= ? and created_at <= ?", startTime, endTime).Find(&quotaDatas).Error
	err = DB.Table("quota_data").Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens, created_at").Where("created_at >= ? and created_at <= ?", startTime, endTime).Group("model_name, created_at").Find(&quotaDatas).Error
	if err != nil {
		return nil, err
	}
	pending := pendingQuotaDataSnapshot(startTime, endTime, nil)
	return mergePendingQuotaData(quotaDatas, pending, quotaModelHourKey, projectAllModelsRow), nil
}
