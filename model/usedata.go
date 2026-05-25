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
	UserID    int    `json:"user_id" gorm:"index;index:idx_qdt_user_token_model_time,priority:1"`
	Username  string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;size:64;default:''"`
	TokenID   int    `json:"token_id" gorm:"default:0;index;index:idx_qdt_user_token_model_time,priority:2"`
	TokenName string `json:"token_name" gorm:"size:64;default:''"`
	ModelName string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;index:idx_qdt_user_token_model_time,priority:3;size:64;default:''"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2;index:idx_qdt_user_token_model_time,priority:4"`
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

func logQuotaDataCache(userId int, username string, tokenId int, tokenName string, modelName string, quota int, createdAt int64, tokenUsed int) {
	key := fmt.Sprintf("%d-%d-%s-%d", userId, tokenId, modelName, createdAt)
	quotaData, ok := CacheQuotaData[key]
	if ok {
		quotaData.Count += 1
		quotaData.Quota += quota
		quotaData.TokenUsed += tokenUsed
		quotaData.Username = username
		quotaData.TokenName = tokenName
	} else {
		quotaData = &QuotaData{
			UserID:    userId,
			Username:  username,
			TokenID:   tokenId,
			TokenName: tokenName,
			ModelName: modelName,
			CreatedAt: createdAt,
			Count:     1,
			Quota:     quota,
			TokenUsed: tokenUsed,
		}
	}
	CacheQuotaData[key] = quotaData
}

func LogQuotaData(userId int, username string, tokenId int, tokenName string, modelName string, quota int, createdAt int64, tokenUsed int) {
	// 只精确到小时
	createdAt = createdAt - (createdAt % 3600)

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(userId, username, tokenId, tokenName, modelName, quota, createdAt, tokenUsed)
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
		DB.Table("quota_data").Where("user_id = ? and token_id = ? and model_name = ? and created_at = ?",
			quotaData.UserID, quotaData.TokenID, quotaData.ModelName, quotaData.CreatedAt).First(quotaDataDB)
		if quotaDataDB.Id > 0 {
			//quotaDataDB.Count += quotaData.Count
			//quotaDataDB.Quota += quotaData.Quota
			//DB.Table("quota_data").Save(quotaDataDB)
			increaseQuotaData(quotaData.UserID, quotaData.Username, quotaData.TokenID, quotaData.TokenName, quotaData.ModelName, quotaData.Count, quotaData.Quota, quotaData.CreatedAt, quotaData.TokenUsed)
		} else {
			DB.Table("quota_data").Create(quotaData)
		}
	}
	CacheQuotaData = make(map[string]*QuotaData)
	common.SysLog(fmt.Sprintf("保存数据看板数据成功，共保存%d条数据", size))
}

func increaseQuotaData(userId int, username string, tokenId int, tokenName string, modelName string, count int, quota int, createdAt int64, tokenUsed int) {
	err := DB.Table("quota_data").Where("user_id = ? and token_id = ? and model_name = ? and created_at = ?",
		userId, tokenId, modelName, createdAt).Updates(map[string]interface{}{
		"count":      gorm.Expr("count + ?", count),
		"quota":      gorm.Expr("quota + ?", quota),
		"token_used": gorm.Expr("token_used + ?", tokenUsed),
		"username":   username,
		"token_name": tokenName,
	}).Error
	if err != nil {
		common.SysLog(fmt.Sprintf("increaseQuotaData error: %s", err))
	}
}

func aggregateQuotaDataByModel(query *gorm.DB, tokenId int, includeUserFields bool) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	userFields := ""
	if includeUserFields {
		userFields = "min(id) as id, max(user_id) as user_id, max(username) as username, "
	}
	if tokenId > 0 {
		query = query.Select(userFields+"model_name, created_at, ? as token_id, max(token_name) as token_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used", tokenId)
	} else {
		query = query.Select(userFields + "model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used")
	}
	err = query.Group("model_name, created_at").Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataByUsername(username string, startTime int64, endTime int64, tokenId int) (quotaData []*QuotaData, err error) {
	query := DB.Table("quota_data").Where("username = ? and created_at >= ? and created_at <= ?", username, startTime, endTime)
	if tokenId > 0 {
		query = query.Where("token_id = ?", tokenId)
	}
	return aggregateQuotaDataByModel(query, tokenId, true)
}

func GetQuotaDataByUserId(userId int, startTime int64, endTime int64, tokenId int) (quotaData []*QuotaData, err error) {
	query := DB.Table("quota_data").Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime)
	if tokenId > 0 {
		query = query.Where("token_id = ?", tokenId)
	}
	return aggregateQuotaDataByModel(query, tokenId, true)
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

func GetAllQuotaDates(startTime int64, endTime int64, username string, tokenId int) (quotaData []*QuotaData, err error) {
	if username != "" {
		return GetQuotaDataByUsername(username, startTime, endTime, tokenId)
	}
	// 从quota_data表中查询数据
	// only select model_name, sum(count) as count, sum(quota) as quota, model_name, created_at from quota_data group by model_name, created_at;
	//err = DB.Table("quota_data").Where("created_at >= ? and created_at <= ?", startTime, endTime).Find(&quotaDatas).Error
	query := DB.Table("quota_data").Where("created_at >= ? and created_at <= ?", startTime, endTime)
	if tokenId > 0 {
		query = query.Where("token_id = ?", tokenId)
	}
	return aggregateQuotaDataByModel(query, tokenId, false)
}
