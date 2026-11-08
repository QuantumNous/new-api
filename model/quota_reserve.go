package model

import (
	"context"
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// ErrInsufficientUserQuota 表示用户钱包余额不足以完成本次扣减。所有扣减路径
// 都以原子比较并扣减（Redis Lua 或数据库条件更新）为前提，余额不足时返回该
// 错误而不是把余额扣成负数；调用方据此映射为 HTTP 402。
var ErrInsufficientUserQuota = errors.New("insufficient user quota")

type cacheQuotaResult int

const (
	cacheQuotaInsufficient cacheQuotaResult = iota
	cacheQuotaOK
	cacheQuotaMiss
)

const userQuotaReserveScript = `
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
return 1`

const userQuotaDeltaScript = `
if tonumber(redis.call('HGET', KEYS[1], 'Id') or '0') ~= tonumber(ARGV[2])
  or tonumber(redis.call('HGET', KEYS[1], 'CacheSchema') or '0') ~= tonumber(ARGV[3])
  or redis.call('HEXISTS', KEYS[1], 'Quota') == 0 then
  return -1
end
redis.call('HINCRBY', KEYS[1], 'Quota', ARGV[1])
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
	default:
		return cacheQuotaMiss, nil
	}
}

func cacheTryReserveUserQuota(userID int, amount int64) (cacheQuotaResult, error) {
	result, err := common.RDB.Eval(context.Background(), userQuotaReserveScript,
		[]string{getUserCacheKey(userID)}, amount, userID, userCacheSchemaVersion).Int()
	return quotaResultFromLua(result, err)
}

func cacheApplyUserQuotaDelta(userID int, delta int64) (cacheQuotaResult, error) {
	result, err := common.RDB.Eval(context.Background(), userQuotaDeltaScript,
		[]string{getUserCacheKey(userID)}, delta, userID, userCacheSchemaVersion).Int()
	return quotaResultFromLua(result, err)
}

// cacheApplyUserQuotaDeltaStrict 以缓存为权威值同步应用一次额度增量：扣减走
// 守卫式 Lua（余额不足返回 cacheQuotaInsufficient，绝不扣成负数），增加走普通
// 增量脚本。缓存缺失（cacheQuotaMiss）由调用方决定是否水合重试或降级数据库。
func cacheApplyUserQuotaDeltaStrict(userID int, delta int64) (cacheQuotaResult, error) {
	if delta < 0 {
		return cacheTryReserveUserQuota(userID, -delta)
	}
	return cacheApplyUserQuotaDelta(userID, delta)
}

// compensateUserQuotaCache 在缓存已成功增减但持久化失败时，把同一增量反向补回
// 缓存，避免缓存与持久化状态分叉。补偿失败时记录错误，交由缓存 TTL 过期后的
// 数据库水合修正。
func compensateUserQuotaCache(userID int, delta int64) {
	compensated, err := cacheApplyUserQuotaDelta(userID, -delta)
	if err != nil || compensated != cacheQuotaOK {
		common.SysError(common.LogText("failed to compensate user quota cache: result=%d error=%v", compensated, err))
	}
}

// applyUserQuotaDelta 以“Redis 优先、outbox 持久化”的方式同步应用一次额度增量：
//   - 缓存命中时用原子 Lua 比较并增减，成功后按 directDB 决定直写数据库还是入队
//     outbox；持久化失败时反向补偿缓存，保证不丢账、不分叉；
//   - 缓存缺失时先从数据库水合再重试；
//   - Redis 不可用或持续缺失时降级为数据库同步条件更新，并显式删除缓存键，
//     使下一次读取强制从数据库重新水合，避免残留过期余额。
//
// Redis 未启用时保留既有的批量/直写语义：批量模式入队 outbox，否则直写数据库。
func applyUserQuotaDelta(id int, delta int, directDB bool) error {
	if delta == 0 {
		return nil
	}
	if common.RedisEnabled {
		result, err := cacheApplyUserQuotaDeltaStrict(id, int64(delta))
		if err == nil && result == cacheQuotaMiss {
			if _, hydrateErr := GetUserCache(id); hydrateErr == nil {
				result, err = cacheApplyUserQuotaDeltaStrict(id, int64(delta))
			}
		}
		switch {
		case err == nil && result == cacheQuotaOK:
			if persistErr := persistAppliedUserQuotaDelta(id, delta, directDB); persistErr != nil {
				compensateUserQuotaCache(id, int64(delta))
				return persistErr
			}
			return nil
		case err == nil && result == cacheQuotaInsufficient:
			return ErrInsufficientUserQuota
		default:
			common.SysLog(common.LogText("user quota cache update unavailable, falling back to database: %v", err))
		}
		// Redis 故障/缓存缺失：同步写库并尽力失效缓存键，使下次读取从数据库重新
		// 水合。缓存键删除失败不影响已提交的数据库扣减，仅记录日志。
		if err := applyUserQuotaDeltaDB(id, delta); err != nil {
			return err
		}
		if err := invalidateUserCache(id); err != nil {
			common.SysLog(common.LogText("failed to invalidate user cache after quota fallback: %s", err.Error()))
		}
		return nil
	}
	return persistUserQuotaDelta(id, delta)
}

// persistAppliedUserQuotaDelta 在缓存已更新后持久化同一增量：directDB 时直写数据库
// （受余额/上限约束），否则交给批量 outbox（未启用批量时 persistUserQuotaDelta 直写）。
func persistAppliedUserQuotaDelta(id int, delta int, directDB bool) error {
	if directDB {
		return applyUserQuotaDeltaDB(id, delta)
	}
	return persistUserQuotaDelta(id, delta)
}

// applyUserQuotaDeltaDB 直写数据库应用增量：扣减受 quota >= ? 约束，增加受钱包
// 上限约束。余额不足返回 ErrInsufficientUserQuota，用户不存在返回 ErrRecordNotFound。
func applyUserQuotaDeltaDB(id int, delta int) error {
	if delta < 0 {
		return decreaseUserQuotaDB(id, -delta)
	}
	return increaseUserQuotaTx(DB, id, delta)
}

// decreaseUserQuotaDB 以条件更新扣减余额，保证余额永远不会被扣成负数。
func decreaseUserQuotaDB(id int, amount int) error {
	if amount <= 0 {
		return nil
	}
	result := DB.Model(&User{}).
		Where("id = ? AND quota >= ?", id, amount).
		Update("quota", gorm.Expr("quota - ?", amount))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 1 {
		return nil
	}
	var count int64
	if err := DB.Model(&User{}).Where("id = ?", id).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return ErrInsufficientUserQuota
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

// persistUserQuotaDelta 把已在缓存侧预扣成功的增量落库；批量模式下入队，直写
// 模式下用条件更新（扣减要求 quota >= ?，绝不扣成负数；用户已删除时报错，交由
// 调用方补偿缓存）。
func persistUserQuotaDelta(id int, delta int) error {
	if common.BatchUpdateEnabled {
		addNewRecord(BatchUpdateTypeUserQuota, id, delta)
		return nil
	}
	return applyUserQuotaDeltaDB(id, delta)
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
// Redis 异常或水合失败时降级为数据库条件更新，保证服务可用。
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

	result, err := cacheTryReserveUserQuota(id, int64(quota))
	if err == nil && result == cacheQuotaMiss {
		if _, hydrateErr := GetUserCache(id); hydrateErr == nil {
			result, err = cacheTryReserveUserQuota(id, int64(quota))
		}
	}
	if err != nil || result == cacheQuotaMiss {
		if err != nil {
			common.SysLog(common.LogText("user quota cache reserve unavailable, falling back to database: %s", err.Error()))
		}
		return reserveUserQuotaDB(id, quota)
	}
	if result == cacheQuotaInsufficient {
		return false, nil
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
