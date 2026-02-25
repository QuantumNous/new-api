package model

import (
	"errors"
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
	TokenUsed int    `json:"token_used" gorm:"default:0"`
	Count     int    `json:"count" gorm:"default:0"`
	Quota     int    `json:"quota" gorm:"default:0"`
}

type UserConsumeRank struct {
	UserID    int    `json:"user_id"`
	Username  string `json:"username"`
	TokenUsed int64  `json:"token_used"`
	Count     int64  `json:"count"`
	Quota     int64  `json:"quota"`
}

type UserModelConsumeRank struct {
	ModelName string `json:"model_name"`
	TokenUsed int64  `json:"token_used"`
	Count     int64  `json:"count"`
	Quota     int64  `json:"quota"`
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
	// 只精确到小时
	createdAt = createdAt - (createdAt % 3600)

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(userId, username, modelName, quota, createdAt, tokenUsed)
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
		DB.Table("quota_data").Where("user_id = ? and username = ? and model_name = ? and created_at = ?",
			quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt).First(quotaDataDB)
		if quotaDataDB.Id > 0 {
			//quotaDataDB.Count += quotaData.Count
			//quotaDataDB.Quota += quotaData.Quota
			//DB.Table("quota_data").Save(quotaDataDB)
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
	// 从quota_data表中查询数据
	err = DB.Table("quota_data").Where("username = ? and created_at >= ? and created_at <= ?", username, startTime, endTime).Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataByUserId(userId int, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	return GetUserQuotaDates(userId, startTime, endTime)
}

func GetUserQuotaDates(userId int, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	if _, err = checkRankParam(rankCheckParam{
		userID:      userId,
		checkUserID: true,
		startTime:   startTime,
		endTime:     endTime,
	}); err != nil {
		return nil, err
	}

	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	err = DB.Table("quota_data").Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime).Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetAllQuotaDates(startTime int64, endTime int64, username string) (quotaData []*QuotaData, err error) {
	if username != "" {
		return GetQuotaDataByUsername(username, startTime, endTime)
	}
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	// only select model_name, sum(count) as count, sum(quota) as quota, model_name, created_at from quota_data group by model_name, created_at;
	//err = DB.Table("quota_data").Where("created_at >= ? and created_at <= ?", startTime, endTime).Find(&quotaDatas).Error
	err = DB.Table("quota_data").Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, created_at").Where("created_at >= ? and created_at <= ?", startTime, endTime).Group("model_name, created_at").Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetUserConsumeRankings(startTime int64, endTime int64, limit int, username string) (tokenRank []*UserConsumeRank, quotaRank []*UserConsumeRank, err error) {
	limit, err = checkRankParam(rankCheckParam{
		startTime:    startTime,
		endTime:      endTime,
		limit:        limit,
		defaultLimit: 20,
		maxLimit:     100,
		checkLimit:   true,
	})
	if err != nil {
		return nil, nil, err
	}

	getBaseQuery := func() *gorm.DB {
		baseQuery := DB.Table("quota_data").Where("created_at >= ? and created_at <= ?", startTime, endTime)
		if username != "" {
			baseQuery = baseQuery.Where("username = ?", username)
		}
		return baseQuery
	}

	selectField := "user_id, MAX(username) as username, sum(token_used) as token_used, sum(count) as count, sum(quota) as quota"
	err = getBaseQuery().Select(selectField).
		Group("user_id").
		Order("token_used DESC").
		Order("username ASC").
		Limit(limit).
		Find(&tokenRank).Error
	if err != nil {
		return nil, nil, err
	}

	err = getBaseQuery().Select(selectField).
		Group("user_id").
		Order("quota DESC").
		Order("username ASC").
		Limit(limit).
		Find(&quotaRank).Error
	if err != nil {
		return nil, nil, err
	}
	return tokenRank, quotaRank, nil
}

func GetUserModelConsumeRankings(userId int, startTime int64, endTime int64, limit int) (tokenRank []*UserModelConsumeRank, quotaRank []*UserModelConsumeRank, err error) {
	limit, err = checkRankParam(rankCheckParam{
		userID:       userId,
		checkUserID:  true,
		startTime:    startTime,
		endTime:      endTime,
		limit:        limit,
		defaultLimit: 50,
		maxLimit:     200,
		checkLimit:   true,
	})
	if err != nil {
		return nil, nil, err
	}

	getBaseQuery := func() *gorm.DB {
		return DB.Table("quota_data").Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime)
	}
	selectField := "model_name, sum(token_used) as token_used, sum(count) as count, sum(quota) as quota"
	err = getBaseQuery().Select(selectField).
		Group("model_name").
		Order("token_used DESC").
		Order("model_name ASC").
		Limit(limit).
		Find(&tokenRank).Error
	if err != nil {
		return nil, nil, err
	}

	err = getBaseQuery().Select(selectField).
		Group("model_name").
		Order("quota DESC").
		Order("model_name ASC").
		Limit(limit).
		Find(&quotaRank).Error
	if err != nil {
		return nil, nil, err
	}
	return tokenRank, quotaRank, nil
}

type rankCheckParam struct {
	userID       int
	checkUserID  bool
	startTime    int64
	endTime      int64
	limit        int
	defaultLimit int
	maxLimit     int
	checkLimit   bool
}

func checkRankParam(param rankCheckParam) (int, error) {
	if param.checkUserID && param.userID <= 0 {
		return 0, errors.New("invalid user id")
	}
	if param.startTime <= 0 {
		return 0, errors.New("invalid start time")
	}
	if param.endTime <= 0 {
		return 0, errors.New("invalid end time")
	}
	if param.endTime < param.startTime {
		return 0, errors.New("invalid time range")
	}
	if param.endTime-param.startTime > 2592000 {
		return 0, errors.New("time span cannot exceed 1 month")
	}

	if !param.checkLimit {
		return 0, nil
	}
	limit := param.limit
	if limit <= 0 {
		limit = param.defaultLimit
	}
	if param.maxLimit > 0 && limit > param.maxLimit {
		limit = param.maxLimit
	}
	return limit, nil
}
