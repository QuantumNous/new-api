package model

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type QuotaData struct {
	Id        int    `json:"id"`
	UserID    int    `json:"user_id" gorm:"index"`
	Username  string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;size:64;default:''"`
	ModelName string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;size:64;default:''"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2"`
	TokenUsed int    `json:"token_used" gorm:"default:0"`
	Count     int    `json:"count" gorm:"default:0"`
	Quota     int    `json:"quota" gorm:"default:0"`
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

func logQuotaDataCache(userId int, username string, modelName string, quota int, createdAt int64, tokenUsed int) {
	key := fmt.Sprintf("%d-%s-%s-%d", userId, username, modelName, createdAt)
	quotaData, ok := CacheQuotaData[key]
	if ok {
		quotaData.Count += 1
		quotaData.Quota += quota
		quotaData.TokenUsed += tokenUsed
	} else {
		quotaData = &QuotaData{
			UserID:    userId,
			Username:  username,
			ModelName: modelName,
			CreatedAt: createdAt,
			Count:     1,
			Quota:     quota,
			TokenUsed: tokenUsed,
		}
	}
	CacheQuotaData[key] = quotaData
}

func LogQuotaData(userId int, username string, modelName string, quota int, createdAt int64, tokenUsed int) {
	createdAt = createdAt - (createdAt % 3600)

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(userId, username, modelName, quota, createdAt, tokenUsed)
}

func SaveQuotaDataCache() {
	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	size := len(CacheQuotaData)
	for _, quotaData := range CacheQuotaData {
		quotaDataDB := &QuotaData{}
		DB.Table("quota_data").Where("user_id = ? and username = ? and model_name = ? and created_at = ?",
			quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt).First(quotaDataDB)
		if quotaDataDB.Id > 0 {
			increaseQuotaData(quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.Count, quotaData.Quota, quotaData.CreatedAt, quotaData.TokenUsed)
		} else {
			DB.Table("quota_data").Create(quotaData)
		}
	}
	CacheQuotaData = make(map[string]*QuotaData)
	common.SysLog(fmt.Sprintf("保存数据看板数据成功，共保存%d条数据", size))
}

func increaseQuotaData(userId int, username string, modelName string, count int, quota int, createdAt int64, tokenUsed int) {
	err := DB.Table("quota_data").Where("user_id = ? and username = ? and model_name = ? and created_at = ?",
		userId, username, modelName, createdAt).Updates(map[string]interface{}{
		"count":      gorm.Expr("count + ?", count),
		"quota":      gorm.Expr("quota + ?", quota),
		"token_used": gorm.Expr("token_used + ?", tokenUsed),
	}).Error
	if err != nil {
		common.SysLog(fmt.Sprintf("increaseQuotaData error: %s", err))
	}
}

func GetQuotaDataByUsername(username string, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	err = DB.Table("quota_data").Where("username = ? and created_at >= ? and created_at <= ?", username, startTime, endTime).Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataByUserId(userId int, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	err = DB.Table("quota_data").Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime).Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataGroupByUser(startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	err = DB.Table("quota_data").
		Select("username, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Group("username, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetAllQuotaDates(startTime int64, endTime int64, username string) (quotaData []*QuotaData, err error) {
	if username != "" {
		return GetQuotaDataByUsername(username, startTime, endTime)
	}
	var quotaDatas []*QuotaData
	err = DB.Table("quota_data").Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, created_at").Where("created_at >= ? and created_at <= ?", startTime, endTime).Group("model_name, created_at").Find(&quotaDatas).Error
	return quotaDatas, err
}

type UserModelStatItem struct {
	Username  string `json:"username"`
	ModelName string `json:"model_name"`
	Count     int    `json:"count"`
	TokenUsed int    `json:"token_used"`
	Quota     int    `json:"quota"`
}

type MatrixPagination struct {
	UserPage   int `json:"user_page"`
	ModelPage  int `json:"model_page"`
	PageSize   int `json:"page_size"`
	UserTotal  int `json:"user_total"`
	ModelTotal int `json:"model_total"`
}

type MatrixCell struct {
	Username  string `json:"username"`
	ModelName string `json:"model_name"`
	Count     int    `json:"count"`
	TokenUsed int    `json:"token_used"`
	Quota     int    `json:"quota"`
}

type MatrixTopSummary struct {
	Username  string `json:"username,omitempty"`
	ModelName string `json:"model_name,omitempty"`
	TokenUsed int    `json:"token_used"`
}

type MatrixStatResponse struct {
	Users   []string     `json:"users"`
	Models  []string     `json:"models"`
	Cells   []MatrixCell `json:"cells"`
	Summary struct {
		TopUser  MatrixTopSummary `json:"top_user"`
		TopModel MatrixTopSummary `json:"top_model"`
	} `json:"summary"`
	Pagination MatrixPagination `json:"pagination"`
}

func GetUserModelStatsByUser(startTime int64, endTime int64, usernames []string, modelNames []string, page int, pageSize int) (items []*UserModelStatItem, total int64, err error) {
	tx := DB.Table("quota_data").
		Select("username, model_name, sum(count) as count, sum(token_used) as token_used, sum(quota) as quota").
		Where("created_at >= ? and created_at <= ?", startTime, endTime)

	if len(usernames) > 0 {
		tx = tx.Where("username IN ?", usernames)
	}
	if len(modelNames) > 0 {
		tx = tx.Where("model_name IN ?", modelNames)
	}

	err = tx.Group("username, model_name").Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = tx.Group("username, model_name").
		Order("sum(token_used) desc").
		Limit(pageSize).Offset((page - 1) * pageSize).
		Find(&items).Error
	return items, total, err
}

func GetUserModelStatsByModel(startTime int64, endTime int64, usernames []string, modelNames []string, page int, pageSize int) (items []*UserModelStatItem, total int64, err error) {
	return GetUserModelStatsBase(startTime, endTime, usernames, modelNames, page, pageSize)
}

func GetUserModelStatsBase(startTime int64, endTime int64, usernames []string, modelNames []string, page int, pageSize int) (items []*UserModelStatItem, total int64, err error) {
	tx := DB.Table("quota_data").
		Select("username, model_name, sum(count) as count, sum(token_used) as token_used, sum(quota) as quota").
		Where("created_at >= ? and created_at <= ?", startTime, endTime)

	if len(usernames) > 0 {
		tx = tx.Where("username IN ?", usernames)
	}
	if len(modelNames) > 0 {
		tx = tx.Where("model_name IN ?", modelNames)
	}

	err = tx.Group("username, model_name").Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = tx.Group("username, model_name").
		Order("sum(token_used) desc").
		Limit(pageSize).Offset((page - 1) * pageSize).
		Find(&items).Error
	return items, total, err
}

func GetUserModelMatrix(startTime int64, endTime int64, usernames []string, modelNames []string, userPage int, modelPage int, pageSize int) (*MatrixStatResponse, error) {
	var all []*UserModelStatItem
	tx := DB.Table("quota_data").
		Select("username, model_name, sum(count) as count, sum(token_used) as token_used, sum(quota) as quota").
		Where("created_at >= ? and created_at <= ?", startTime, endTime)
	if len(usernames) > 0 {
		tx = tx.Where("username IN ?", usernames)
	}
	if len(modelNames) > 0 {
		tx = tx.Where("model_name IN ?", modelNames)
	}
	err := tx.Group("username, model_name").Find(&all).Error
	if err != nil {
		return nil, err
	}

	userMap := make(map[string]int)
	modelMap := make(map[string]int)
	for _, it := range all {
		userMap[it.Username] += it.TokenUsed
		modelMap[it.ModelName] += it.TokenUsed
	}

	users := sortKeysByValue(userMap)
	models := sortKeysByValue(modelMap)

	if len(usernames) == 0 {
		users = truncateWithOthers(users, pageSize)
	}
	if len(modelNames) == 0 {
		models = truncateWithOthers(models, pageSize)
	}

	userStart := (userPage - 1) * pageSize
	modelStart := (modelPage - 1) * pageSize
	if userStart >= len(users) {
		userStart = len(users)
	}
	if modelStart >= len(models) {
		modelStart = len(models)
	}
	userEnd := userStart + pageSize
	modelEnd := modelStart + pageSize
	if userEnd > len(users) {
		userEnd = len(users)
	}
	if modelEnd > len(models) {
		modelEnd = len(models)
	}
	pageUsers := users[userStart:userEnd]
	pageModels := models[modelStart:modelEnd]

	userSet := make(map[string]bool)
	modelSet := make(map[string]bool)
	for _, u := range pageUsers {
		userSet[u] = true
	}
	for _, m := range pageModels {
		modelSet[m] = true
	}

	type cellKey struct{ u, m string }
	cellMap := make(map[cellKey]*MatrixCell)
	for _, it := range all {
		u := it.Username
		m := it.ModelName
		if !userSet[u] && !contains(pageUsers, "others") {
			u = "others"
		}
		if !modelSet[m] && !contains(pageModels, "others") {
			m = "others"
		}
		if !userSet[u] && u != "others" {
			continue
		}
		if !modelSet[m] && m != "others" {
			continue
		}
		key := cellKey{u, m}
		if cellMap[key] == nil {
			cellMap[key] = &MatrixCell{Username: u, ModelName: m}
		}
		cellMap[key].Count += it.Count
		cellMap[key].TokenUsed += it.TokenUsed
		cellMap[key].Quota += it.Quota
	}

	cells := make([]MatrixCell, 0, len(cellMap))
	for _, c := range cellMap {
		cells = append(cells, *c)
	}

	resp := &MatrixStatResponse{
		Users:  pageUsers,
		Models: pageModels,
		Cells:  cells,
		Pagination: MatrixPagination{
			UserPage:   userPage,
			ModelPage:  modelPage,
			PageSize:   pageSize,
			UserTotal:  len(users),
			ModelTotal: len(models),
		},
	}
	if len(users) > 0 {
		resp.Summary.TopUser = MatrixTopSummary{Username: users[0], TokenUsed: userMap[users[0]]}
	}
	if len(models) > 0 {
		resp.Summary.TopModel = MatrixTopSummary{ModelName: models[0], TokenUsed: modelMap[models[0]]}
	}
	return resp, nil
}

func sortKeysByValue(m map[string]int) []string {
	type kv struct {
		key   string
		value int
	}
	var items []kv
	for k, v := range m {
		items = append(items, kv{k, v})
	}
	for i := 0; i < len(items)-1; i++ {
		for j := i + 1; j < len(items); j++ {
			if items[j].value > items[i].value {
				items[i], items[j] = items[j], items[i]
			}
		}
	}
	keys := make([]string, len(items))
	for i, it := range items {
		keys[i] = it.key
	}
	return keys
}

func truncateWithOthers(keys []string, limit int) []string {
	if len(keys) <= limit {
		return keys
	}
	return append(keys[:limit], "others")
}

func contains(arr []string, s string) bool {
	for _, v := range arr {
		if v == s {
			return true
		}
	}
	return false
}
