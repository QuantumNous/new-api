package model

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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

func UpdateQuotaData() {
	for {
		if common.DataExportEnabled {
			common.SysLog("正在更新数据看板数据...")
			SaveQuotaDataCache()
			SaveQuotaDataTokenCache()
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

// QuotaDataToken 令牌维度聚合数据
// 与 QuotaData 并行存在；自然键为 (user_id, token_id, model_name, created_at-小时)。
// token_name / username 仅作为展示用标签，会随每次 upsert 刷新为最新值。
type QuotaDataToken struct {
	Id        int    `json:"id"`
	UserID    int    `json:"user_id" gorm:"uniqueIndex:uniq_qdtk,priority:1"`
	Username  string `json:"username" gorm:"size:64;default:''"`
	TokenID   int    `json:"token_id" gorm:"uniqueIndex:uniq_qdtk,priority:2;default:0"`
	TokenName string `json:"token_name" gorm:"index;size:64;default:''"`
	ModelName string `json:"model_name" gorm:"uniqueIndex:uniq_qdtk,priority:3;size:64;default:''"`
	CreatedAt int64  `json:"created_at" gorm:"uniqueIndex:uniq_qdtk,priority:4;index:idx_qdtk_created"`
	TokenUsed int    `json:"token_used" gorm:"default:0"`
	Count     int    `json:"count" gorm:"default:0"`
	Quota     int    `json:"quota" gorm:"default:0"`
}

var CacheQuotaDataToken = make(map[string]*QuotaDataToken)
var CacheQuotaDataTokenLock = sync.Mutex{}

// 缓存键只用自然键，避免 username/token_name 变更时产生重复桶。
func tokenCacheKey(userId, tokenId int, modelName string, createdAt int64) string {
	return fmt.Sprintf("%d-%d-%s-%d", userId, tokenId, modelName, createdAt)
}

func logQuotaDataTokenCache(userId int, username string, tokenId int, tokenName string, modelName string, quota int, createdAt int64, tokenUsed int) {
	key := tokenCacheKey(userId, tokenId, modelName, createdAt)
	row, ok := CacheQuotaDataToken[key]
	if ok {
		row.Count += 1
		row.Quota += quota
		row.TokenUsed += tokenUsed
		// 标签字段刷新为最新值，避免历史改名导致 stale label
		row.Username = username
		row.TokenName = tokenName
	} else {
		row = &QuotaDataToken{
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
	CacheQuotaDataToken[key] = row
}

// LogQuotaDataToken 记录令牌维度聚合（小时粒度）。
// tokenId<=0（系统/管理员渠道测试 / violation_fee 等没有实际令牌的调用）直接丢弃，
// 防止 caller 漏判时污染令牌看板。
func LogQuotaDataToken(userId int, username string, tokenId int, tokenName string, modelName string, quota int, createdAt int64, tokenUsed int) {
	if tokenId <= 0 {
		return
	}
	createdAt = createdAt - (createdAt % 3600)
	CacheQuotaDataTokenLock.Lock()
	defer CacheQuotaDataTokenLock.Unlock()
	logQuotaDataTokenCache(userId, username, tokenId, tokenName, modelName, quota, createdAt, tokenUsed)
}

// SaveQuotaDataTokenCache 落盘逻辑：先 swap 出快照释放锁，再做 IO，避免阻塞 LogQuotaDataToken。
// 每行使用 ON CONFLICT DO NOTHING 占位 + UPDATE 累加，保证并发安全（多副本部署不重复）。
func SaveQuotaDataTokenCache() {
	CacheQuotaDataTokenLock.Lock()
	snapshot := CacheQuotaDataToken
	CacheQuotaDataToken = make(map[string]*QuotaDataToken)
	CacheQuotaDataTokenLock.Unlock()

	size := len(snapshot)
	if size == 0 {
		return
	}
	for _, row := range snapshot {
		// 单行事务：seed + accumulate 必须同时成功，否则一并回滚，
		// 避免出现 count=0 的孤儿行被后续 OnConflict DoNothing 永久保留。
		err := DB.Transaction(func(tx *gorm.DB) error {
			seed := &QuotaDataToken{
				UserID:    row.UserID,
				Username:  row.Username,
				TokenID:   row.TokenID,
				TokenName: row.TokenName,
				ModelName: row.ModelName,
				CreatedAt: row.CreatedAt,
			}
			if e := tx.Table("quota_data_tokens").
				Clauses(clause.OnConflict{DoNothing: true}).
				Create(seed).Error; e != nil {
				return e
			}
			return tx.Table("quota_data_tokens").Where(
				"user_id = ? and token_id = ? and model_name = ? and created_at = ?",
				row.UserID, row.TokenID, row.ModelName, row.CreatedAt,
			).Updates(map[string]interface{}{
				"count":      gorm.Expr("count + ?", row.Count),
				"quota":      gorm.Expr("quota + ?", row.Quota),
				"token_used": gorm.Expr("token_used + ?", row.TokenUsed),
				"username":   row.Username,
				"token_name": row.TokenName,
			}).Error
		})
		if err != nil {
			common.SysLog(fmt.Sprintf("SaveQuotaDataTokenCache upsert error: %s", err))
		}
	}
	common.SysLog(fmt.Sprintf("保存令牌维度数据看板数据成功，共保存%d条数据", size))
}

// GetTokenQuotaDates 管理员查询所有用户的令牌维度数据。可选过滤 username / token_name。
// uniqueIndex 已保证 (user_id, token_id, model_name, created_at) 唯一，故直接 SELECT，
// 不做聚合 —— 前端会根据 (token_id, token_name) 二次聚合呈现。
func GetTokenQuotaDates(startTime int64, endTime int64, username string, tokenName string) (rows []*QuotaDataToken, err error) {
	tx := DB.Table("quota_data_tokens").
		Where("created_at >= ? and created_at <= ?", startTime, endTime)
	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	err = tx.Find(&rows).Error
	return rows, err
}

// GetUserTokenQuotaDates 普通用户查询自己的令牌维度数据。
func GetUserTokenQuotaDates(userId int, startTime int64, endTime int64, tokenName string) (rows []*QuotaDataToken, err error) {
	tx := DB.Table("quota_data_tokens").
		Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime)
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	err = tx.Find(&rows).Error
	return rows, err
}
