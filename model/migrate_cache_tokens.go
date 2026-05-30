package model

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
)

func MigrateCacheTokens() {
	if !common.DataExportEnabled {
		return
	}
	common.SysLog("开始回填 quota_data 缓存 token 数据...")

	batchSize := 1000
	lastID := 0
	totalUpdated := 0

	for {
		var records []QuotaData
		err := DB.Table("quota_data").
			Where("id > ? AND cache_tokens = 0 AND cache_creation_tokens = 0 AND cache_creation_tokens_5m = 0 AND cache_creation_tokens_1h = 0", lastID).
			Order("id ASC").Limit(batchSize).
			Find(&records).Error
		if err != nil {
			common.SysLog(fmt.Sprintf("回填缓存 token 数据查询失败: %s", err))
			return
		}
		if len(records) == 0 {
			break
		}

		for _, record := range records {
			cacheTokens, cacheCreationTokens, cacheCreationTokens5m, cacheCreationTokens1h := queryCacheTokensFromLogs(record.UserID, record.ModelName, record.CreatedAt)
			if cacheTokens == 0 && cacheCreationTokens == 0 && cacheCreationTokens5m == 0 && cacheCreationTokens1h == 0 {
				continue
			}
			err := DB.Table("quota_data").Where("id = ?", record.Id).Updates(map[string]interface{}{
				"cache_tokens":             cacheTokens,
				"cache_creation_tokens":    cacheCreationTokens,
				"cache_creation_tokens_5m": cacheCreationTokens5m,
				"cache_creation_tokens_1h": cacheCreationTokens1h,
			}).Error
			if err != nil {
				common.SysLog(fmt.Sprintf("回填 quota_data id=%d 失败: %s", record.Id, err))
			} else {
				totalUpdated++
			}
		}

		lastID = records[len(records)-1].Id
		time.Sleep(100 * time.Millisecond)
	}

	common.SysLog(fmt.Sprintf("缓存 token 数据回填完成，共更新 %d 条记录", totalUpdated))
}

func queryCacheTokensFromLogs(userId int, modelName string, createdAt int64) (int, int, int, int) {
	startTime := createdAt
	endTime := createdAt + 3600

	var result struct {
		CacheTokens           int
		CacheCreationTokens   int
		CacheCreationTokens5m int
		CacheCreationTokens1h int
	}

	if common.UsingPostgreSQL {
		err := LOG_DB.Table("logs").
			Select(`COALESCE(SUM(CAST(other::json->>'cache_tokens' AS INTEGER)), 0) as cache_tokens,
				COALESCE(SUM(CAST(other::json->>'cache_creation_tokens' AS INTEGER)), 0) as cache_creation_tokens,
				COALESCE(SUM(CAST(other::json->>'cache_creation_tokens_5m' AS INTEGER)), 0) as cache_creation_tokens_5m,
				COALESCE(SUM(CAST(other::json->>'cache_creation_tokens_1h' AS INTEGER)), 0) as cache_creation_tokens_1h`).
			Where("user_id = ? AND model_name = ? AND type = ? AND created_at >= ? AND created_at < ? AND other <> ''",
				userId, modelName, LogTypeConsume, startTime, endTime).
			Scan(&result).Error
		if err != nil {
			common.SysLog(fmt.Sprintf("回填查询日志失败 (pg): userId=%d, model=%s, err=%s", userId, modelName, err))
			return 0, 0, 0, 0
		}
	} else if common.UsingMySQL {
		err := LOG_DB.Table("logs").
			Select(`COALESCE(SUM(CAST(JSON_EXTRACT(other, '$.cache_tokens') AS SIGNED)), 0) as cache_tokens,
				COALESCE(SUM(CAST(JSON_EXTRACT(other, '$.cache_creation_tokens') AS SIGNED)), 0) as cache_creation_tokens,
				COALESCE(SUM(CAST(JSON_EXTRACT(other, '$.cache_creation_tokens_5m') AS SIGNED)), 0) as cache_creation_tokens_5m,
				COALESCE(SUM(CAST(JSON_EXTRACT(other, '$.cache_creation_tokens_1h') AS SIGNED)), 0) as cache_creation_tokens_1h`).
			Where("user_id = ? AND model_name = ? AND type = ? AND created_at >= ? AND created_at < ? AND other <> ''",
				userId, modelName, LogTypeConsume, startTime, endTime).
			Scan(&result).Error
		if err != nil {
			common.SysLog(fmt.Sprintf("回填查询日志失败 (mysql): userId=%d, model=%s, err=%s", userId, modelName, err))
			return 0, 0, 0, 0
		}
	} else {
		// SQLite
		err := LOG_DB.Table("logs").
			Select(`COALESCE(SUM(CAST(json_extract(other, '$.cache_tokens') AS INTEGER)), 0) as cache_tokens,
				COALESCE(SUM(CAST(json_extract(other, '$.cache_creation_tokens') AS INTEGER)), 0) as cache_creation_tokens,
				COALESCE(SUM(CAST(json_extract(other, '$.cache_creation_tokens_5m') AS INTEGER)), 0) as cache_creation_tokens_5m,
				COALESCE(SUM(CAST(json_extract(other, '$.cache_creation_tokens_1h') AS INTEGER)), 0) as cache_creation_tokens_1h`).
			Where("user_id = ? AND model_name = ? AND type = ? AND created_at >= ? AND created_at < ? AND other <> ''",
				userId, modelName, LogTypeConsume, startTime, endTime).
			Scan(&result).Error
		if err != nil {
			common.SysLog(fmt.Sprintf("回填查询日志失败 (sqlite): userId=%d, model=%s, err=%s", userId, modelName, err))
			return 0, 0, 0, 0
		}
	}

	return result.CacheTokens, result.CacheCreationTokens, result.CacheCreationTokens5m, result.CacheCreationTokens1h
}
