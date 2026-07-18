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
	tokenQuotaLockWait = 2 * time.Second
	tokenQuotaLockTTL  = 30 * time.Second
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

func cacheDeleteToken(key string) error {
	tokenHMAC := common.GenerateHMAC(key)
	return invalidateImageTaskQuotaCache(
		fmt.Sprintf("token:%s", tokenHMAC),
		imageTaskTokenQuotaPinsKey(tokenHMAC),
		imageTaskTokenQuotaInvalidationKey(tokenHMAC),
		common.TokenStatusDisabled,
	)
}

func cacheIncrTokenQuota(key string, increment int64) error {
	key = common.GenerateHMAC(key)
	err := common.RedisHIncrBy(fmt.Sprintf("token:%s", key), constant.TokenFiledRemainQuota, increment)
	if err != nil {
		return err
	}
	return nil
}

func cacheDecrTokenQuota(key string, decrement int64) error {
	return cacheIncrTokenQuota(key, -decrement)
}

func cacheTryDecrTokenQuota(tokenId int, key string, decrement int64) error {
	if !common.RedisEnabled {
		return nil
	}
	hmacKey := common.GenerateHMAC(key)
	err := common.RedisHDecrByIfEnough(
		fmt.Sprintf("token:%s", hmacKey),
		constant.TokenFiledRemainQuota,
		"UnlimitedQuota",
		decrement,
	)
	if !errors.Is(err, common.ErrRedisQuotaUnavailable) {
		return err
	}
	if err := ensureTokenQuotaCache(tokenId, key); err != nil {
		return err
	}
	return common.RedisHDecrByIfEnough(
		fmt.Sprintf("token:%s", hmacKey),
		constant.TokenFiledRemainQuota,
		"UnlimitedQuota",
		decrement,
	)
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

func ensureTokenQuotaCache(tokenId int, key string) error {
	if !common.RedisEnabled {
		return nil
	}
	if token, err := cacheGetTokenByKey(key); err == nil && token.Id == tokenId {
		return nil
	}

	var token Token
	if err := DB.Where(&Token{Id: tokenId, Key: key}).First(&token).Error; err != nil {
		return err
	}
	if err := cacheSetTokenIfAbsent(token); err != nil {
		return err
	}
	cached, err := cacheGetTokenByKey(key)
	if err != nil {
		return fmt.Errorf("failed to initialize token quota cache: %w", err)
	}
	if cached.Id != tokenId {
		return fmt.Errorf("token quota cache id mismatch")
	}
	return nil
}

// withTokenQuotaCacheLock serializes explicit token quota edits with durable
// async reservations across gateway nodes. Normal delta-only cache writes do
// not replace complete token snapshots and do not need this lock.
func withTokenQuotaCacheLock(key string, fn func() error) error {
	if fn == nil {
		return errors.New("token quota operation is required")
	}
	if !common.RedisEnabled {
		return fn()
	}
	if common.RDB == nil {
		return errors.New("redis is enabled but unavailable")
	}
	if key == "" {
		return errors.New("token key is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), tokenQuotaLockWait)
	defer cancel()
	lockKey := fmt.Sprintf("lock:token-quota:%s", common.GenerateHMAC(key))
	lockValue := common.GetUUID()
	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()
	for {
		acquired, err := common.RDB.SetNX(ctx, lockKey, lockValue, tokenQuotaLockTTL).Result()
		if err != nil {
			return fmt.Errorf("acquire token quota lock: %w", err)
		}
		if acquired {
			break
		}
		select {
		case <-ctx.Done():
			return errors.New("timed out acquiring token quota lock")
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
