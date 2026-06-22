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
	NodeName  string `json:"node_name" gorm:"size:64;default:''"`
	TokenID   int    `json:"token_id" gorm:"default:0"`
	UseGroup  string `json:"use_group" gorm:"column:use_group;size:64;default:''"`
	ChannelID int    `json:"channel_id" gorm:"default:0"`
	ModelName string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;size:64;default:''"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2"`
	TokenUsed int    `json:"token_used" gorm:"default:0"`
	Count     int    `json:"count" gorm:"default:0"`
	Quota     int    `json:"quota" gorm:"default:0"`
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

func logQuotaDataCache(params QuotaDataLogParams) {
	key := fmt.Sprintf("%d-%s-%s-%s-%d-%s-%d-%d", params.UserID, params.Username, params.NodeName, params.ModelName, params.CreatedAt, params.UseGroup, params.TokenID, params.ChannelID)
	quotaData, ok := CacheQuotaData[key]
	if ok {
		quotaData.Count += 1
		quotaData.Quota += params.Quota
		quotaData.TokenUsed += params.TokenUsed
	} else {
		quotaData = &QuotaData{
			UserID:    params.UserID,
			Username:  params.Username,
			NodeName:  params.NodeName,
			TokenID:   params.TokenID,
			UseGroup:  params.UseGroup,
			ChannelID: params.ChannelID,
			ModelName: params.ModelName,
			CreatedAt: params.CreatedAt,
			Count:     1,
			Quota:     params.Quota,
			TokenUsed: params.TokenUsed,
		}
	}
	CacheQuotaData[key] = quotaData
}

func LogQuotaData(params QuotaDataLogParams) {
	params.CreatedAt = params.CreatedAt - (params.CreatedAt % 3600)

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(params)
}

func SaveQuotaDataCache() {
	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	size := len(CacheQuotaData)
	for _, quotaData := range CacheQuotaData {
		quotaDataDB := &QuotaData{}
		DB.Table("quota_data").Where("user_id = ? and username = ? and node_name = ? and token_id = ? and use_group = ? and channel_id = ? and model_name = ? and created_at = ?",
			quotaData.UserID, quotaData.Username, quotaData.NodeName, quotaData.TokenID, quotaData.UseGroup, quotaData.ChannelID, quotaData.ModelName, quotaData.CreatedAt).First(quotaDataDB)
		if quotaDataDB.Id > 0 {
			increaseQuotaData(quotaData, quotaData.Count, quotaData.Quota, quotaData.TokenUsed)
		} else {
			DB.Table("quota_data").Create(quotaData)
		}
	}
	CacheQuotaData = make(map[string]*QuotaData)
	common.SysLog(fmt.Sprintf("保存数据看板数据成功，共保存%d条数据", size))
}

func increaseQuotaData(quotaData *QuotaData, count int, quota int, tokenUsed int) {
	err := DB.Table("quota_data").Where("user_id = ? and username = ? and node_name = ? and token_id = ? and use_group = ? and channel_id = ? and model_name = ? and created_at = ?",
		quotaData.UserID, quotaData.Username, quotaData.NodeName, quotaData.TokenID, quotaData.UseGroup, quotaData.ChannelID, quotaData.ModelName, quotaData.CreatedAt).Updates(map[string]interface{}{
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
	UserID    int    `json:"user_id"`
	Username  string `json:"username"`
	UserGroup string `json:"user_group"`
	ModelName string `json:"model_name"`
	Count     int    `json:"count"`
	TokenUsed int    `json:"token_used"`
	Quota     int    `json:"quota"`
}

type UserStatItem struct {
	UserID    int    `json:"user_id"`
	Username  string `json:"username"`
	UserGroup string `json:"user_group"`
	OrgPath   string `json:"org_path"`
	Count     int    `json:"count"`
	TokenUsed int    `json:"token_used"`
	Quota     int    `json:"quota"`
}

type ModelStatItem struct {
	ModelName string `json:"model_name"`
	Count     int    `json:"count"`
	TokenUsed int    `json:"token_used"`
	Quota     int    `json:"quota"`
}

type DepartmentStatItem struct {
	OrgLevel1Name string `json:"org_level1_name"`
	OrgLevel2Name string `json:"org_level2_name"`
	Count         int    `json:"count"`
	TokenUsed     int    `json:"token_used"`
	Quota         int    `json:"quota"`
}

func GetUserModelStatsByUser(startTime int64, endTime int64, usernames []string, modelNames []string, userGroup string, page int, pageSize int) (items []*UserStatItem, total int64, err error) {
	groupCol := CommonGroupColumnName()
	selectGroup := fmt.Sprintf("u.%s as user_group", groupCol)

	aggTx := DB.Table("quota_data").
		Select("user_id, sum(count) as count, sum(token_used) as token_used, sum(quota) as quota").
		Where("created_at >= ? and created_at <= ?", startTime, endTime)
	if len(usernames) > 0 {
		aggTx = aggTx.Where("username IN ?", usernames)
	}
	if len(modelNames) > 0 {
		aggTx = aggTx.Where("model_name IN ?", modelNames)
	}
	aggTx = aggTx.Group("user_id")

	baseTx := DB.Table("users AS u").
		Select("u.id as user_id, u.username as username, "+selectGroup+", COALESCE(u.org_path, '') as org_path, COALESCE(q.count, 0) as count, COALESCE(q.token_used, 0) as token_used, COALESCE(q.quota, 0) as quota").
		Joins("LEFT JOIN (?) AS q ON q.user_id = u.id", aggTx).
		Where("u.deleted_at IS NULL")
	if len(usernames) > 0 {
		baseTx = baseTx.Where("u.username IN ?", usernames)
	}
	if userGroup != "" {
		baseTx = baseTx.Where(fmt.Sprintf("u.%s = ?", groupCol), userGroup)
	}

	if err = baseTx.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err = baseTx.
		Order("COALESCE(q.count, 0) desc, COALESCE(q.token_used, 0) desc, COALESCE(q.quota, 0) desc, u.id asc").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&items).Error
	return items, total, err
}

func GetUserModelStatsByModel(startTime int64, endTime int64, usernames []string, modelNames []string, userGroup string, page int, pageSize int) (items []*ModelStatItem, total int64, err error) {
	groupCol := CommonGroupColumnName()

	tx := DB.Table("quota_data q").
		Select("q.model_name as model_name, sum(q.count) as count, sum(q.token_used) as token_used, sum(q.quota) as quota").
		Joins("JOIN users u ON u.id = q.user_id").
		Where("q.created_at >= ? and q.created_at <= ?", startTime, endTime).
		Where("u.deleted_at IS NULL")

	if len(usernames) > 0 {
		tx = tx.Where("q.username IN ?", usernames)
	}
	if len(modelNames) > 0 {
		tx = tx.Where("q.model_name IN ?", modelNames)
	}
	if userGroup != "" {
		tx = tx.Where(fmt.Sprintf("u.%s = ?", groupCol), userGroup)
	}

	countTx := tx.Session(&gorm.Session{})
	err = countTx.Group("q.model_name").Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = tx.Group("q.model_name").
		Order("sum(q.count) desc, sum(q.token_used) desc, sum(q.quota) desc").
		Limit(pageSize).Offset((page - 1) * pageSize).
		Find(&items).Error
	return items, total, err
}

func GetUserModelStatsByDepartment(startTime int64, endTime int64, usernames []string, modelNames []string, userGroup string, page int, pageSize int) (items []*DepartmentStatItem, total int64, err error) {
	groupCol := CommonGroupColumnName()

	tx := DB.Table("quota_data q").
		Select("COALESCE(u.org_level1_name, '') as org_level1_name, COALESCE(u.org_level2_name, '') as org_level2_name, sum(q.count) as count, sum(q.token_used) as token_used, sum(q.quota) as quota").
		Joins("JOIN users u ON u.id = q.user_id").
		Where("q.created_at >= ? and q.created_at <= ?", startTime, endTime).
		Where("u.deleted_at IS NULL")

	if len(usernames) > 0 {
		tx = tx.Where("q.username IN ?", usernames)
	}
	if len(modelNames) > 0 {
		tx = tx.Where("q.model_name IN ?", modelNames)
	}
	if userGroup != "" {
		tx = tx.Where(fmt.Sprintf("u.%s = ?", groupCol), userGroup)
	}

	countTx := tx.Session(&gorm.Session{})
	err = countTx.Group("u.org_level1_name, u.org_level2_name").Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = tx.Group("u.org_level1_name, u.org_level2_name").
		Order("sum(q.count) desc, sum(q.token_used) desc, sum(q.quota) desc").
		Limit(pageSize).Offset((page - 1) * pageSize).
		Find(&items).Error
	return items, total, err
}

func GetUserModelStatsByDetail(startTime int64, endTime int64, usernames []string, modelNames []string, userGroup string, page int, pageSize int) (items []*UserModelStatItem, total int64, err error) {
	groupCol := CommonGroupColumnName()
	selectGroup := fmt.Sprintf("u.%s as user_group", groupCol)

	tx := DB.Table("quota_data q").
		Select("q.user_id as user_id, u.username as username, "+selectGroup+", q.model_name as model_name, sum(q.count) as count, sum(q.token_used) as token_used, sum(q.quota) as quota").
		Joins("JOIN users u ON u.id = q.user_id").
		Where("q.created_at >= ? and q.created_at <= ?", startTime, endTime).
		Where("u.deleted_at IS NULL")

	if len(usernames) > 0 {
		tx = tx.Where("q.username IN ?", usernames)
	}
	if len(modelNames) > 0 {
		tx = tx.Where("q.model_name IN ?", modelNames)
	}
	if userGroup != "" {
		tx = tx.Where(fmt.Sprintf("u.%s = ?", groupCol), userGroup)
	}

	countTx := tx.Session(&gorm.Session{})
	err = countTx.Group("q.user_id, q.model_name, u.username, " + groupCol).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = tx.Group("q.user_id, q.model_name, u.username, " + groupCol).
		Order("sum(q.count) desc, sum(q.token_used) desc, sum(q.quota) desc").
		Limit(pageSize).Offset((page - 1) * pageSize).
		Find(&items).Error
	return items, total, err
}
