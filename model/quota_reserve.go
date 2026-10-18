package model

import (
	"context"
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type cacheQuotaResult int

const (
	cacheQuotaInsufficient cacheQuotaResult = iota
	cacheQuotaOK
	cacheQuotaMiss
	cacheQuotaPending
)

const userQuotaReserveScript = `
if redis.call('EXISTS', KEYS[2]) == 1 then
  return -2
end
if tonumber(redis.call('HGET', KEYS[1], 'Id') or '0') ~= tonumber(ARGV[2])
  or tonumber(redis.call('HGET', KEYS[1], 'CacheSchema') or '0') ~= tonumber(ARGV[3])
  or redis.call('HEXISTS', KEYS[1], 'Quota') == 0 then
  return -1
end
local quota = tonumber(redis.call('HGET', KEYS[1], 'Quota'))
if quota == nil or quota < tonumber(ARGV[1]) then
  return 0
end
redis.call('HINCRBY', KEYS[1], 'Quota', -tonumber(ARGV[1]))
if ARGV[4] ~= '' then
  local clock = redis.call('TIME')
  local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
  redis.call('ZADD', KEYS[3], now + tonumber(ARGV[5]), ARGV[4])
  redis.call('EXPIRE', KEYS[3], ARGV[6])
  redis.call('EXPIRE', KEYS[1], ARGV[7])
end
return 1`

const userQuotaDeltaScript = `
if redis.call('EXISTS', KEYS[2]) == 1 then
  return -2
end
local cache_valid = tonumber(redis.call('HGET', KEYS[1], 'Id') or '0') == tonumber(ARGV[2])
  and tonumber(redis.call('HGET', KEYS[1], 'CacheSchema') or '0') == tonumber(ARGV[3])
  and redis.call('HEXISTS', KEYS[1], 'Quota') == 1
if ARGV[4] ~= '' then
  local clock = redis.call('TIME')
  local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
  redis.call('ZADD', KEYS[3], now + tonumber(ARGV[5]), ARGV[4])
  redis.call('EXPIRE', KEYS[3], ARGV[6])
end
if not cache_valid then
  return -1
end
redis.call('HINCRBY', KEYS[1], 'Quota', ARGV[1])
if ARGV[4] ~= '' then
  redis.call('EXPIRE', KEYS[1], ARGV[7])
end
return 1`

const tokenQuotaReserveScript = `
if tonumber(redis.call('HGET', KEYS[1], 'Id') or '0') ~= tonumber(ARGV[2])
  or redis.call('HEXISTS', KEYS[1], 'RemainQuota') == 0
  or redis.call('HEXISTS', KEYS[1], 'UsedQuota') == 0 then
  return -1
end
local remain = tonumber(redis.call('HGET', KEYS[1], 'RemainQuota'))
if remain == nil or remain < tonumber(ARGV[1]) then
  return 0
end
redis.call('HINCRBY', KEYS[1], 'RemainQuota', -tonumber(ARGV[1]))
redis.call('HINCRBY', KEYS[1], 'UsedQuota', tonumber(ARGV[1]))
redis.call('HSET', KEYS[1], 'AccessedTime', ARGV[3])
return 1`

const tokenQuotaDeltaScript = `
if tonumber(redis.call('HGET', KEYS[1], 'Id') or '0') ~= tonumber(ARGV[2])
  or redis.call('HEXISTS', KEYS[1], 'RemainQuota') == 0
  or redis.call('HEXISTS', KEYS[1], 'UsedQuota') == 0 then
  return -1
end
redis.call('HINCRBY', KEYS[1], 'RemainQuota', tonumber(ARGV[1]))
redis.call('HINCRBY', KEYS[1], 'UsedQuota', -tonumber(ARGV[1]))
redis.call('HSET', KEYS[1], 'AccessedTime', ARGV[3])
return 1`

func quotaResultFromLua(result int, err error) (cacheQuotaResult, error) {
	if err != nil {
		return cacheQuotaMiss, err
	}
	switch result {
	case 1:
		return cacheQuotaOK, nil
	case 0:
		return cacheQuotaInsufficient, nil
	case -2:
		return cacheQuotaPending, nil
	default:
		return cacheQuotaMiss, nil
	}
}

func cacheTryReserveUserQuotaWithBatchOwner(userID int, amount int64, owner string) (cacheQuotaResult, error) {
	result, err := common.RDB.Eval(context.Background(), userQuotaReserveScript,
		[]string{
			getUserCacheKey(userID),
			getUserQuotaMutationFenceKey(userID),
			getUserQuotaBatchPendingKey(userID),
		},
		amount,
		userID,
		userCacheSchemaVersion,
		owner,
		userQuotaBatchPendingLeaseMillis(),
		userQuotaBatchPendingKeyTTLSeconds(),
		userQuotaMutationHashTTLSeconds(),
	).Int()
	return quotaResultFromLua(result, err)
}

func cacheTryReserveUserQuota(userID int, amount int64) (cacheQuotaResult, error) {
	return cacheTryReserveUserQuotaWithBatchOwner(userID, amount, "")
}

func cacheApplyUserQuotaDeltaWithBatchOwner(userID int, delta int64, owner string) (cacheQuotaResult, error) {
	result, err := common.RDB.Eval(context.Background(), userQuotaDeltaScript,
		[]string{
			getUserCacheKey(userID),
			getUserQuotaMutationFenceKey(userID),
			getUserQuotaBatchPendingKey(userID),
		},
		delta,
		userID,
		userCacheSchemaVersion,
		owner,
		userQuotaBatchPendingLeaseMillis(),
		userQuotaBatchPendingKeyTTLSeconds(),
		userQuotaMutationHashTTLSeconds(),
	).Int()
	return quotaResultFromLua(result, err)
}

func cacheApplyUserQuotaDelta(userID int, delta int64) (cacheQuotaResult, error) {
	return cacheApplyUserQuotaDeltaWithBatchOwner(userID, delta, "")
}

func cacheTryReserveTokenQuota(id int, key string, amount int64) (cacheQuotaResult, error) {
	result, err := common.RDB.Eval(context.Background(), tokenQuotaReserveScript,
		[]string{getTokenCacheKey(key)}, amount, id, common.GetTimestamp()).Int()
	return quotaResultFromLua(result, err)
}

func cacheApplyTokenQuotaDelta(id int, key string, delta int64) (cacheQuotaResult, error) {
	result, err := common.RDB.Eval(context.Background(), tokenQuotaDeltaScript,
		[]string{getTokenCacheKey(key)}, delta, id, common.GetTimestamp()).Int()
	return quotaResultFromLua(result, err)
}

// persistUserQuotaDelta writes a synchronously reserved delta to the database.
// Batch mode queues through cacheTryReserveAndQueueUserQuota instead.
func persistUserQuotaDelta(id int, delta int) error {
	result := DB.Model(&User{}).Where("id = ?", id).Update("quota", gorm.Expr("quota + ?", delta))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func persistTokenQuotaDelta(id int, delta int) error {
	if common.BatchUpdateEnabled {
		addNewRecord(BatchUpdateTypeTokenQuota, id, delta)
		return nil
	}
	result := DB.Model(&Token{}).Where("id = ?", id).Updates(
		map[string]any{
			"remain_quota":  gorm.Expr("remain_quota + ?", delta),
			"used_quota":    gorm.Expr("used_quota - ?", delta),
			"accessed_time": common.GetTimestamp(),
		},
	)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func reserveUserQuotaDB(id int, quota int) (bool, error) {
	result := DB.Model(&User{}).
		Where("id = ? AND quota >= ?", id, quota).
		Update("quota", gorm.Expr("quota - ?", quota))
	return result.RowsAffected == 1, result.Error
}

func reserveTokenQuotaDB(id int, quota int) (bool, error) {
	result := DB.Model(&Token{}).
		Where("id = ? AND remain_quota >= ?", id, quota).
		Updates(map[string]any{
			"remain_quota":  gorm.Expr("remain_quota - ?", quota),
			"used_quota":    gorm.Expr("used_quota + ?", quota),
			"accessed_time": common.GetTimestamp(),
		})
	return result.RowsAffected == 1, result.Error
}

// TryReserveUserQuota atomically checks and deducts a user's wallet quota.
// 缓存命中时以缓存余额为准（避免批量模式下过期的数据库余额放大并发超扣）；
// Redis 异常、水合失败或额度变更 fence 存在时失败关闭，不能回退到可能
// 落后于批量额度更新的数据库余额。
func TryReserveUserQuota(id int, quota int) (bool, error) {
	if quota < 0 {
		return false, errors.New("quota cannot be negative")
	}
	if quota == 0 {
		return true, nil
	}
	if !common.RedisEnabled {
		return reserveUserQuotaDB(id, quota)
	}

	var result cacheQuotaResult
	var err error
	if common.BatchUpdateEnabled {
		result, err = cacheTryReserveAndQueueUserQuota(id, quota)
	} else {
		result, err = cacheTryReserveUserQuota(id, int64(quota))
	}
	if err != nil {
		return false, err
	}
	if result == cacheQuotaPending {
		return false, ErrUserQuotaMutationPending
	}
	if result == cacheQuotaMiss {
		if _, hydrateErr := GetUserCache(id); hydrateErr != nil {
			return false, hydrateErr
		}
		if common.BatchUpdateEnabled {
			result, err = cacheTryReserveAndQueueUserQuota(id, quota)
		} else {
			result, err = cacheTryReserveUserQuota(id, int64(quota))
		}
		if err != nil {
			return false, err
		}
	}
	if result == cacheQuotaPending {
		return false, ErrUserQuotaMutationPending
	}
	if result == cacheQuotaMiss {
		return false, errors.New("user quota cache could not be initialized")
	}
	if result == cacheQuotaInsufficient {
		return false, nil
	}
	if common.BatchUpdateEnabled {
		return true, nil
	}
	if err = persistUserQuotaDelta(id, -quota); err != nil {
		compensated, compensateErr := cacheApplyUserQuotaDelta(id, int64(quota))
		if compensateErr != nil || compensated != cacheQuotaOK {
			common.SysError(common.LogText("failed to compensate reserved user quota: result=%d error=%v", compensated, compensateErr))
		}
		return false, err
	}
	return true, nil
}

// TryReserveTokenQuota atomically checks and deducts a token quota. Unlimited
// tokens skip the balance check but still update remain/used accounting.
func TryReserveTokenQuota(id int, key string, quota int, unlimited bool) (bool, error) {
	if quota < 0 {
		return false, errors.New("quota cannot be negative")
	}
	if quota == 0 {
		return true, nil
	}
	if unlimited {
		return true, DecreaseTokenQuota(id, key, quota)
	}
	if !common.RedisEnabled {
		return reserveTokenQuotaDB(id, quota)
	}

	result, err := cacheTryReserveTokenQuota(id, key, int64(quota))
	if err == nil && result == cacheQuotaMiss {
		if _, hydrateErr := GetTokenByKey(key, true); hydrateErr == nil {
			result, err = cacheTryReserveTokenQuota(id, key, int64(quota))
		}
	}
	if err != nil || result == cacheQuotaMiss {
		if err != nil {
			common.SysLog(common.LogText("token quota cache reserve unavailable, falling back to database: %s", err.Error()))
		}
		return reserveTokenQuotaDB(id, quota)
	}
	if result == cacheQuotaInsufficient {
		return false, nil
	}
	if err = persistTokenQuotaDelta(id, -quota); err != nil {
		compensated, compensateErr := cacheApplyTokenQuotaDelta(id, key, int64(quota))
		if compensateErr != nil || compensated != cacheQuotaOK {
			common.SysError(common.LogText("failed to compensate reserved token quota: result=%d error=%v", compensated, compensateErr))
		}
		return false, err
	}
	return true, nil
}
