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
	// ChannelId 渠道维度统计所需；旧数据为 0
	ChannelId int   `json:"channel_id" gorm:"index:idx_qdt_channel_created,priority:1;default:0"`
	CreatedAt int64 `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2;index:idx_qdt_channel_created,priority:2"`
	TokenUsed int   `json:"token_used" gorm:"default:0"`
	Count     int   `json:"count" gorm:"default:0"`
	Quota     int   `json:"quota" gorm:"default:0"`
	// ChannelQuota 按渠道计费倍率折算后的渠道维度成本（quota × 渠道倍率）
	ChannelQuota int `json:"channel_quota" gorm:"default:0"`
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

func logQuotaDataCache(userId int, username string, modelName string, channelId int, quota int, channelQuota int, createdAt int64, tokenUsed int) {
	key := fmt.Sprintf("%d-%s-%s-%d-%d", userId, username, modelName, channelId, createdAt)
	quotaData, ok := CacheQuotaData[key]
	if ok {
		quotaData.Count += 1
		quotaData.Quota += quota
		quotaData.ChannelQuota += channelQuota
		quotaData.TokenUsed += tokenUsed
	} else {
		quotaData = &QuotaData{
			UserID:       userId,
			Username:     username,
			ModelName:    modelName,
			ChannelId:    channelId,
			CreatedAt:    createdAt,
			Count:        1,
			Quota:        quota,
			ChannelQuota: channelQuota,
			TokenUsed:    tokenUsed,
		}
	}
	CacheQuotaData[key] = quotaData
}

func LogQuotaData(userId int, username string, modelName string, channelId int, quota int, channelQuota int, createdAt int64, tokenUsed int) {
	// 只精确到小时
	createdAt = createdAt - (createdAt % 3600)

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(userId, username, modelName, channelId, quota, channelQuota, createdAt, tokenUsed)
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
		DB.Table("quota_data").Where("user_id = ? and username = ? and model_name = ? and channel_id = ? and created_at = ?",
			quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.ChannelId, quotaData.CreatedAt).First(quotaDataDB)
		if quotaDataDB.Id > 0 {
			increaseQuotaData(quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.ChannelId, quotaData.Count, quotaData.Quota, quotaData.ChannelQuota, quotaData.CreatedAt, quotaData.TokenUsed)
		} else {
			DB.Table("quota_data").Create(quotaData)
		}
	}
	CacheQuotaData = make(map[string]*QuotaData)
	common.SysLog(fmt.Sprintf("保存数据看板数据成功，共保存%d条数据", size))
}

func increaseQuotaData(userId int, username string, modelName string, channelId int, count int, quota int, channelQuota int, createdAt int64, tokenUsed int) {
	err := DB.Table("quota_data").Where("user_id = ? and username = ? and model_name = ? and channel_id = ? and created_at = ?",
		userId, username, modelName, channelId, createdAt).Updates(map[string]interface{}{
		"count":         gorm.Expr("count + ?", count),
		"quota":         gorm.Expr("quota + ?", quota),
		"channel_quota": gorm.Expr("channel_quota + ?", channelQuota),
		"token_used":    gorm.Expr("token_used + ?", tokenUsed),
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
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
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
	// 从quota_data表中查询数据
	// only select model_name, sum(count) as count, sum(quota) as quota, model_name, created_at from quota_data group by model_name, created_at;
	//err = DB.Table("quota_data").Where("created_at >= ? and created_at <= ?", startTime, endTime).Find(&quotaDatas).Error
	err = DB.Table("quota_data").Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, created_at").Where("created_at >= ? and created_at <= ?", startTime, endTime).Group("model_name, created_at").Find(&quotaDatas).Error
	return quotaDatas, err
}

// ChannelQuotaTrendPoint 渠道维度成本时间序列点（按小时聚合，前端再按粒度归并）。
// Quota 为原始消耗额度之和，ChannelQuota 为按渠道计费倍率折算后的渠道维度成本。
type ChannelQuotaTrendPoint struct {
	ChannelId    int   `json:"channel_id"`
	CreatedAt    int64 `json:"created_at"`
	Count        int   `json:"count"`
	Quota        int   `json:"quota"`
	ChannelQuota int   `json:"channel_quota"`
}

// ChannelQuotaMeta 渠道元信息：名称 + 当前配置的计费倍率。
type ChannelQuotaMeta struct {
	ChannelId    int     `json:"channel_id"`
	ChannelName  string  `json:"channel_name"`
	CurrentRatio float64 `json:"current_ratio"`
}

// ChannelQuotaResult 渠道成本数据：时间序列 + 渠道元信息（仅管理员可见）。
type ChannelQuotaResult struct {
	Points   []*ChannelQuotaTrendPoint `json:"points"`
	Channels []*ChannelQuotaMeta       `json:"channels"`
}

// GetChannelQuotaData 从 quota_data 预聚合表读取渠道维度成本时间序列（按小时）。
func GetChannelQuotaData(startTime int64, endTime int64) (*ChannelQuotaResult, error) {
	var points []*ChannelQuotaTrendPoint
	tx := DB.Table("quota_data").
		Select("channel_id, created_at, SUM(count) as count, SUM(quota) as quota, SUM(channel_quota) as channel_quota").
		Where("channel_id > 0")
	if startTime != 0 {
		tx = tx.Where("created_at >= ?", startTime)
	}
	if endTime != 0 {
		tx = tx.Where("created_at <= ?", endTime)
	}
	if err := tx.Group("channel_id, created_at").Find(&points).Error; err != nil {
		return nil, err
	}
	// 收集渠道元信息（名称 + 当前配置倍率；渠道可能已删除，缺失时留空）
	idSet := make(map[int]bool)
	for _, p := range points {
		idSet[p.ChannelId] = true
	}
	channels := make([]*ChannelQuotaMeta, 0, len(idSet))
	for id := range idSet {
		meta := &ChannelQuotaMeta{ChannelId: id, CurrentRatio: 1}
		if ch, err := CacheGetChannel(id); err == nil && ch != nil {
			meta.ChannelName = ch.Name
			meta.CurrentRatio = ch.GetChannelRatio()
		}
		channels = append(channels, meta)
	}
	return &ChannelQuotaResult{Points: points, Channels: channels}, nil
}
