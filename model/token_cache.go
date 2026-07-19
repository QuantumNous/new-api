package model

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
)

const (
	quotaCacheLockWait = 2 * time.Second
	quotaCacheLockTTL  = 30 * time.Second
)

var (
	errQuotaCacheLockUnavailable = errors.New("quota cache lock is unavailable")
	errQuotaCacheLockTimeout     = errors.New("quota cache lock timed out")
)

func cacheSetToken(token Token) error {
	key := common.GenerateHMAC(token.Key)
	token.Clean()
	err := common.RedisHSetObj(fmt.Sprintf("token:%s", key), &token, time.Duration(common.RedisKeyCacheSeconds())*time.Second)
	if err != nil {
		return err
	}
	return nil
}

func cacheSetTokenIfAbsent(token Token) error {
	key := common.GenerateHMAC(token.Key)
	token.Clean()
	_, err := common.RedisHSetObjIfAbsent(
		fmt.Sprintf("token:%s", key),
		&token,
		time.Duration(common.RedisKeyCacheSeconds())*time.Second,
	)
	return err
}

func tokenQuotaCacheGenerationKey(key string) string {
	return fmt.Sprintf("billing:quota-cache-generation:token:%s", common.GenerateHMAC(key))
}

func tokenQuotaCacheGeneration(key string) (int64, error) {
	if !common.RedisEnabled {
		return 0, nil
	}
	if common.RDB == nil {
		return 0, errors.New("redis is enabled but unavailable")
	}
	return common.RedisGeneration(tokenQuotaCacheGenerationKey(key))
}

func cacheSetTokenAtGeneration(token Token, generation int64) (bool, error) {
	if !common.RedisEnabled {
		return false, nil
	}
	tokenHMAC := common.GenerateHMAC(token.Key)
	generationKey := tokenQuotaCacheGenerationKey(token.Key)
	token.Clean()
	return common.RedisHSetObjIfGeneration(
		fmt.Sprintf("token:%s", tokenHMAC),
		imageTaskTokenQuotaPinsKey(tokenHMAC),
		imageTaskTokenQuotaInvalidationKey(tokenHMAC),
		generationKey,
		generation,
		&token,
		time.Duration(common.RedisKeyCacheSeconds())*time.Second,
	)
}

func invalidateTokenQuotaCacheWithStatus(key string, invalidStatus *int) error {
	if !common.RedisEnabled {
		return nil
	}
	if common.RDB == nil {
		return errors.New("redis is enabled but unavailable")
	}
	tokenHMAC := common.GenerateHMAC(key)
	_, err := common.RedisHInvalidateWithGeneration(
		fmt.Sprintf("token:%s", tokenHMAC),
		imageTaskTokenQuotaPinsKey(tokenHMAC),
		imageTaskTokenQuotaInvalidationKey(tokenHMAC),
		tokenQuotaCacheGenerationKey(key),
		time.Duration(imageTaskQuotaCacheHoldSeconds)*time.Second,
		invalidStatus,
	)
	return err
}

func invalidateTokenQuotaCache(key string) error {
	return invalidateTokenQuotaCacheWithStatus(key, nil)
}

func applyTokenQuotaCacheDelta(key string, delta int64) error {
	if !common.RedisEnabled {
		return nil
	}
	if common.RDB == nil {
		return errors.New("redis is enabled but unavailable")
	}
	tokenHMAC := common.GenerateHMAC(key)
	_, err := common.RedisHApplyDeltaAndInvalidateWithGeneration(
		fmt.Sprintf("token:%s", tokenHMAC),
		imageTaskTokenQuotaPinsKey(tokenHMAC),
		imageTaskTokenQuotaInvalidationKey(tokenHMAC),
		tokenQuotaCacheGenerationKey(key),
		time.Duration(imageTaskQuotaCacheHoldSeconds)*time.Second,
		constant.TokenFiledRemainQuota,
		delta,
	)
	return err
}

func applyTokenQuotaCacheDeltaOnce(key string, delta int64, operationKey string) error {
	if !common.RedisEnabled {
		return nil
	}
	if common.RDB == nil {
		return errors.New("redis is enabled but unavailable")
	}
	tokenHMAC := common.GenerateHMAC(key)
	_, err := common.RedisHApplyDeltaAndInvalidateWithGenerationOnce(
		fmt.Sprintf("token:%s", tokenHMAC),
		imageTaskTokenQuotaPinsKey(tokenHMAC),
		imageTaskTokenQuotaInvalidationKey(tokenHMAC),
		tokenQuotaCacheGenerationKey(key),
		time.Duration(imageTaskQuotaCacheHoldSeconds)*time.Second,
		constant.TokenFiledRemainQuota,
		delta,
		operationKey,
		30*24*time.Hour,
	)
	return err
}

func cacheDeleteToken(key string) error {
	invalidStatus := common.TokenStatusDisabled
	return invalidateTokenQuotaCacheWithStatus(key, &invalidStatus)
}

func cacheIncrTokenQuota(key string, increment int64) error {
	return applyTokenQuotaCacheDelta(key, increment)
}

func cacheDecrTokenQuota(key string, decrement int64) error {
	return cacheIncrTokenQuota(key, -decrement)
}

func cacheSetTokenField(key string, field string, value string) error {
	key = common.GenerateHMAC(key)
	err := common.RedisHSetField(fmt.Sprintf("token:%s", key), field, value)
	if err != nil {
		return err
	}
	return nil
}

// CacheGetTokenByKey 从缓存中获取 token，如果缓存中不存在，则从数据库中获取
func cacheGetTokenByKey(key string) (*Token, error) {
	hmacKey := common.GenerateHMAC(key)
	if !common.RedisEnabled {
		return nil, fmt.Errorf("redis is not enabled")
	}
	var token Token
	err := common.RedisHGetObj(fmt.Sprintf("token:%s", hmacKey), &token)
	if err != nil {
		return nil, err
	}
	if token.Id == 0 {
		return nil, fmt.Errorf("incomplete token cache")
	}
	token.Key = key
	return &token, nil
}

func cacheGetTokenByKeyForRead(key string) (*Token, error) {
	hmacKey := common.GenerateHMAC(key)
	if !common.RedisEnabled {
		return nil, fmt.Errorf("redis is not enabled")
	}
	var token Token
	err := common.RedisHGetObjIfValid(
		fmt.Sprintf("token:%s", hmacKey),
		imageTaskTokenQuotaInvalidationKey(hmacKey),
		&token,
	)
	if err != nil {
		return nil, err
	}
	if token.Id == 0 {
		return nil, fmt.Errorf("incomplete token cache")
	}
	token.Key = key
	return &token, nil
}

func ensureTokenQuotaCache(tokenId int, key string) error {
	if !common.RedisEnabled {
		return nil
	}
	var lastErr error
	for attempt := 0; attempt < quotaCachePopulateAttempts; attempt++ {
		if token, err := cacheGetTokenByKey(key); err == nil && token.Id == tokenId {
			return nil
		}

		generation, err := tokenQuotaCacheGeneration(key)
		if err != nil {
			return err
		}
		var token Token
		if err := DB.Unscoped().Where(&Token{Id: tokenId, Key: key}).First(&token).Error; err != nil {
			return err
		}
		if token.DeletedAt.Valid {
			token.Status = common.TokenStatusDisabled
		}
		if _, err := cacheSetTokenAtGeneration(token, generation); err != nil {
			return err
		}
		cached, err := cacheGetTokenByKey(key)
		if err == nil && cached.Id == tokenId {
			return nil
		}
		if err != nil {
			lastErr = err
		} else {
			lastErr = fmt.Errorf("token quota cache id mismatch")
		}
	}
	return fmt.Errorf("failed to initialize token quota cache after generation retries: %w", lastErr)
}

// withTokenQuotaCacheLock serializes explicit token edits with durable async
// reservations across gateway nodes. DB-first quota mutations invalidate their
// snapshots by generation and do not replace the pinned reconciliation hash.
func withTokenQuotaCacheLock(key string, fn func() error) error {
	if key == "" {
		return errors.New("token key is required")
	}
	return withQuotaCacheLock(fmt.Sprintf("lock:token-quota:%s", common.GenerateHMAC(key)), fn)
}

func withUserQuotaCacheLock(userId int, fn func() error) error {
	if userId <= 0 {
		return errors.New("user id is required")
	}
	return withQuotaCacheLock(fmt.Sprintf("lock:user-quota:%d", userId), fn)
}

func withImageTaskQuotaCacheLocks(userId int, tokenKey string, fn func() error) error {
	return withUserQuotaCacheLock(userId, func() error {
		if err := reconcileUserBillingAdjustmentCacheLocked(userId); err != nil {
			return fmt.Errorf("reconcile durable user quota cache adjustments before image task: %w", err)
		}
		if tokenKey == "" {
			return fn()
		}
		return withTokenQuotaCacheLock(tokenKey, func() error {
			var token Token
			if err := DB.Unscoped().Where(&Token{Key: tokenKey}).First(&token).Error; err != nil {
				return err
			}
			if err := reconcileTokenBillingAdjustmentCacheLocked(token.Id, tokenKey); err != nil {
				return fmt.Errorf("reconcile durable token quota cache adjustments before image task: %w", err)
			}
			return fn()
		})
	})
}

func withQuotaCacheLock(lockKey string, fn func() error) error {
	if fn == nil {
		return errors.New("quota operation is required")
	}
	if !common.RedisEnabled {
		return fn()
	}
	if common.RDB == nil {
		return fmt.Errorf("%w: redis is enabled but unavailable", errQuotaCacheLockUnavailable)
	}

	ctx, cancel := context.WithTimeout(context.Background(), quotaCacheLockWait)
	defer cancel()
	lockValue := common.GetUUID()
	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()
	for {
		acquired, err := common.RDB.SetNX(ctx, lockKey, lockValue, quotaCacheLockTTL).Result()
		if err != nil {
			return fmt.Errorf("%w: %v", errQuotaCacheLockUnavailable, err)
		}
		if acquired {
			break
		}
		select {
		case <-ctx.Done():
			return errQuotaCacheLockTimeout
		case <-ticker.C:
		}
	}

	defer func() {
		const releaseScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`
		releaseCtx, releaseCancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer releaseCancel()
		if err := common.RDB.Eval(releaseCtx, releaseScript, []string{lockKey}, lockValue).Err(); err != nil {
			common.SysLog("failed to release token quota lock: " + err.Error())
		}
	}()
	return fn()
}
