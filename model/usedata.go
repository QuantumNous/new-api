package model

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// QuotaData 柱状图数据
//
// TokenUsed, Count and Quota are explicitly int64. They are money and counter
// columns that are summed across up to 90 days of hourly buckets in the
// dashboard aggregates and accumulated in the in-process write cache, so the
// width must not depend on the build platform's int size. GORM already sizes
// these columns as 64-bit integers, so the declared type is schema-neutral;
// TestQuotaDataSchemaIsUnchangedByInt64Columns pins that.
type QuotaData struct {
	Id        int    `json:"id"`
	UserID    int    `json:"user_id" gorm:"index"`
	Username  string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;size:64;default:''"`
	ModelName string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;size:64;default:''"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2"`
	TokenUsed int64  `json:"token_used" gorm:"default:0"`
	Count     int64  `json:"count" gorm:"default:0"`
	Quota     int64  `json:"quota" gorm:"default:0"`
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

func logQuotaDataCache(userId int, username string, modelName string, quota int64, createdAt int64, tokenUsed int64) {
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

func LogQuotaData(userId int, username string, modelName string, quota int64, createdAt int64, tokenUsed int64) {
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

func increaseQuotaData(userId int, username string, modelName string, count int64, quota int64, createdAt int64, tokenUsed int64) {
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

// defaultMaxQuotaDataRows is an overload circuit breaker for the dashboard
// quota series. quota_data is pre-aggregated per hour, so a 90 day window can
// hold at most 90*24 buckets multiplied by the number of distinct series. The
// cap is sized far above any realistic tenant and exists only so a runaway
// query returns a stable error instead of streaming an unbounded response.
const defaultMaxQuotaDataRows = 200000

// maxQuotaDataRows is a variable purely so tests can exercise the cap and the
// cap+1 overflow with a handful of rows instead of persisting 200001 of them.
// Production never reassigns it; withMaxQuotaDataRows restores it.
var maxQuotaDataRows = defaultMaxQuotaDataRows

var ErrQuotaDataTooManyRows = fmt.Errorf("匹配的看板数据超过 %d 条，请缩小时间范围或筛选条件", defaultMaxQuotaDataRows)

// runSegmentedQuotaDataQuery executes build() once per bounded segment and
// concatenates the results. Segments are disjoint on created_at and created_at
// is part of every grouping used here, so a group key can never appear in two
// segments and concatenation is exact.
//
// The range is validated here as well as at the HTTP boundary. This layer is
// the last place that can stop an unbounded, inverted, or over-long scan, and
// it must not depend on every caller having checked first.
func runSegmentedQuotaDataQuery(
	ctx context.Context,
	startTime int64,
	endTime int64,
	build func(tx *gorm.DB) *gorm.DB,
) ([]*QuotaData, error) {
	segments, err := common.SplitDashboardRange(startTime, endTime)
	if err != nil {
		return nil, err
	}
	db := DB
	if ctx != nil {
		db = db.WithContext(ctx)
	}
	quotaDatas := make([]*QuotaData, 0)
	for _, segment := range segments {
		var segmentRows []*QuotaData
		tx := build(db.Table("quota_data")).
			Where("created_at >= ? and created_at <= ?", segment.Start, segment.End).
			Limit(maxQuotaDataRows + 1)
		if err := tx.Find(&segmentRows).Error; err != nil {
			return nil, err
		}
		if len(segmentRows) > maxQuotaDataRows {
			return nil, ErrQuotaDataTooManyRows
		}
		quotaDatas = append(quotaDatas, segmentRows...)
		if len(quotaDatas) > maxQuotaDataRows {
			return nil, ErrQuotaDataTooManyRows
		}
	}
	return quotaDatas, nil
}

func GetQuotaDataByUsername(ctx context.Context, username string, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	// 从quota_data表中查询数据
	return runSegmentedQuotaDataQuery(ctx, startTime, endTime, func(tx *gorm.DB) *gorm.DB {
		return tx.Where("username = ?", username)
	})
}

func GetQuotaDataByUserId(ctx context.Context, userId int, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	// 从quota_data表中查询数据
	return runSegmentedQuotaDataQuery(ctx, startTime, endTime, func(tx *gorm.DB) *gorm.DB {
		return tx.Where("user_id = ?", userId)
	})
}

func GetQuotaDataGroupByUser(ctx context.Context, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	return runSegmentedQuotaDataQuery(ctx, startTime, endTime, func(tx *gorm.DB) *gorm.DB {
		return tx.Select("username, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
			Group("username, created_at")
	})
}

func GetAllQuotaDates(ctx context.Context, startTime int64, endTime int64, username string) (quotaData []*QuotaData, err error) {
	if username != "" {
		return GetQuotaDataByUsername(ctx, username, startTime, endTime)
	}
	// 从quota_data表中查询数据
	// only select model_name, sum(count) as count, sum(quota) as quota, model_name, created_at from quota_data group by model_name, created_at;
	return runSegmentedQuotaDataQuery(ctx, startTime, endTime, func(tx *gorm.DB) *gorm.DB {
		return tx.Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, created_at").
			Group("model_name, created_at")
	})
}
