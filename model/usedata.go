package model

import (
	"context"
	"fmt"
	"strconv"
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

const quotaDataRedisPrefix = "quota_data:"

func getQuotaDataRedisKey(userId int, modelName string, createdAt int64) string {
	return fmt.Sprintf("%s%d|%s|%d", quotaDataRedisPrefix, userId, modelName, createdAt)
}

var (
	updateQuotaDataStop     = make(chan struct{})
	updateQuotaDataStopOnce sync.Once
)

func StopUpdateQuotaData() {
	updateQuotaDataStopOnce.Do(func() {
		close(updateQuotaDataStop)
	})
}

func UpdateQuotaData() {
	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("UpdateQuotaData panic recovered: %v", r))
		}
	}()
	ticker := time.NewTicker(time.Duration(common.DataExportInterval) * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-updateQuotaDataStop:
			common.SysLog("UpdateQuotaData stopped")
			return
		case <-ticker.C:
			if common.DataExportEnabled {
				common.SysLog("正在更新数据看板数据...")
				SaveQuotaDataCache()
			}
		}
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

func logQuotaDataRedis(userId int, username string, modelName string, quota int, createdAt int64, tokenUsed int) {
	key := getQuotaDataRedisKey(userId, modelName, createdAt)
	// Store metadata fields and ensure key has TTL
	ctx := common.RDB.Context()
	pipe := common.RDB.Pipeline()
	pipe.HSet(ctx, key, "_user_id", userId)
	pipe.HSet(ctx, key, "_username", username)
	pipe.HSet(ctx, key, "_model_name", modelName)
	pipe.HSet(ctx, key, "_created_at", createdAt)
	pipe.Expire(ctx, key, time.Duration(common.DataExportInterval+1)*time.Minute)
	_, _ = pipe.Exec(ctx)
	// Atomic increments (HIncrBy preserves TTL)
	_ = common.RedisHIncrBy(key, "count", 1)
	_ = common.RedisHIncrBy(key, "quota", int64(quota))
	_ = common.RedisHIncrBy(key, "token_used", int64(tokenUsed))
}

func LogQuotaData(userId int, username string, modelName string, quota int, createdAt int64, tokenUsed int) {
	// 只精确到小时
	createdAt = createdAt - (createdAt % 3600)

	if common.RedisEnabled {
		logQuotaDataRedis(userId, username, modelName, quota, createdAt, tokenUsed)
		return
	}
	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(userId, username, modelName, quota, createdAt, tokenUsed)
}

func SaveQuotaDataCache() {
	if common.RedisEnabled {
		saveQuotaDataFromRedis()
		return
	}
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

const quotaDataFlushPrefix = "quota_data_flush:"

func quotaDataFlushTTL() time.Duration {
	interval := common.DataExportInterval
	if interval < 1 {
		interval = 1
	}
	return time.Duration(interval+1) * time.Minute
}

func saveQuotaDataFromRedis() {
	ctx := common.RDB.Context()
	pattern := quotaDataRedisPrefix + "*"
	iter := common.RDB.Scan(ctx, 0, pattern, 100).Iterator()
	keys := make([]string, 0, 100)
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}

	totalCount := 0
	for _, key := range keys {
		// Atomic snapshot: RENAME to a unique flush key. New increments after
		// RENAME land on a fresh auto-created key, and failed snapshots are not overwritten.
		flushKey := fmt.Sprintf("%s%s:%d:%s", quotaDataFlushPrefix, key[len(quotaDataRedisPrefix):], time.Now().UnixNano(), common.GetRandomString(8))
		if err := common.RDB.Rename(ctx, key, flushKey).Err(); err != nil {
			// Key may have been deleted/expired between SCAN and RENAME
			continue
		}
		_ = common.RDB.Expire(ctx, flushKey, quotaDataFlushTTL()).Err()
		if writeQuotaFlushKeyToDB(ctx, flushKey) {
			totalCount++
		}
	}

	// Retry any leftover flush keys from previous failed runs
	flushIter := common.RDB.Scan(ctx, 0, quotaDataFlushPrefix+"*", 100).Iterator()
	for flushIter.Next(ctx) {
		if writeQuotaFlushKeyToDB(ctx, flushIter.Val()) {
			totalCount++
		}
	}

	if totalCount > 0 {
		common.SysLog(fmt.Sprintf("保存数据看板数据成功，共保存%d条数据", totalCount))
	}
}

// writeQuotaFlushKeyToDB reads a flush key, writes to DB, and only DELs on
// successful DB write. Returns true on success.
func writeQuotaFlushKeyToDB(ctx context.Context, flushKey string) bool {
	fields, err := common.RDB.HGetAll(ctx, flushKey).Result()
	if err != nil || len(fields) == 0 {
		return false
	}
	userId, _ := strconv.Atoi(fields["_user_id"])
	username := fields["_username"]
	modelName := fields["_model_name"]
	createdAt, _ := strconv.ParseInt(fields["_created_at"], 10, 64)
	count, _ := strconv.Atoi(fields["count"])
	quota, _ := strconv.Atoi(fields["quota"])
	tokenUsed, _ := strconv.Atoi(fields["token_used"])

	if userId <= 0 || username == "" || modelName == "" || createdAt <= 0 {
		// Corrupted, drop it
		_ = common.RDB.Del(ctx, flushKey).Err()
		return false
	}

	var dbErr error
	quotaDataDB := &QuotaData{}
	if err := DB.Table("quota_data").Where("user_id = ? and username = ? and model_name = ? and created_at = ?",
		userId, username, modelName, createdAt).First(quotaDataDB).Error; err == nil && quotaDataDB.Id > 0 {
		dbErr = DB.Table("quota_data").Where("id = ?", quotaDataDB.Id).Updates(map[string]interface{}{
			"count":      gorm.Expr("count + ?", count),
			"quota":      gorm.Expr("quota + ?", quota),
			"token_used": gorm.Expr("token_used + ?", tokenUsed),
		}).Error
	} else {
		dbErr = DB.Table("quota_data").Create(&QuotaData{
			UserID:    userId,
			Username:  username,
			ModelName: modelName,
			CreatedAt: createdAt,
			Count:     count,
			Quota:     quota,
			TokenUsed: tokenUsed,
		}).Error
	}

	if dbErr != nil {
		common.SysError(fmt.Sprintf("saveQuotaData DB write failed for %s: %v (will retry next round)", flushKey, dbErr))
		_ = common.RDB.Expire(ctx, flushKey, quotaDataFlushTTL()).Err()
		return false
	}
	// Only DEL after successful DB write
	_ = common.RDB.Del(ctx, flushKey).Err()
	return true
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
