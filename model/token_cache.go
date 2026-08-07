package model

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
)

func cacheSetToken(token Token) error {
	version, err := imageAutoTokenQuotaCacheVersion(token.Key)
	if err != nil {
		return err
	}
	_, err = cacheSetTokenAtImageAutoQuotaCacheVersion(token, version)
	return err
}

func tokenCacheKey(key string) string {
	return fmt.Sprintf("token:%s", common.GenerateHMAC(key))
}

func tokenCacheVersionKey(key string) string {
	return fmt.Sprintf("cache-version:token:%s", common.GenerateHMAC(key))
}

func imageAutoTokenQuotaCacheVersion(key string) (int64, error) {
	return common.RedisCacheVersion(tokenCacheVersionKey(key))
}

func cacheSetTokenAtImageAutoQuotaCacheVersion(token Token, version int64) (bool, error) {
	key := token.Key
	token.Clean()
	written, err := common.RedisHSetObjIfVersion(
		tokenCacheKey(key),
		&token,
		time.Duration(common.RedisKeyCacheSeconds())*time.Second,
		tokenCacheVersionKey(key),
		version,
	)
	if err != nil || !written {
		return written, err
	}
	return true, common.RedisHApplyPendingDelta(tokenCacheKey(key), constant.TokenFiledRemainQuota, tokenCacheVersionKey(key))
}

func cacheDeleteToken(key string) error {
	return common.RedisBumpCacheVersionAndDelete(tokenCacheVersionKey(key), tokenCacheKey(key))
}

func cacheIncrTokenQuota(key string, increment int64) error {
	return common.RedisHIncrByWithVersion(
		tokenCacheKey(key),
		constant.TokenFiledRemainQuota,
		increment,
		tokenCacheVersionKey(key),
	)
}

func cacheDecrTokenQuota(key string, decrement int64) error {
	return cacheIncrTokenQuota(key, -decrement)
}

func cacheIncrTokenQuotaPending(key string, delta int64) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisHIncrByWithVersionPending(
		tokenCacheKey(key),
		constant.TokenFiledRemainQuota,
		delta,
		tokenCacheVersionKey(key),
	)
}

func cacheAcknowledgeTokenQuotaPendingDelta(key string, delta int64) error {
	if !common.RedisEnabled {
		return nil
	}
	return common.RedisHAcknowledgePendingDelta(tokenCacheKey(key), constant.TokenFiledRemainQuota, delta, tokenCacheVersionKey(key))
}

func cacheSetTokenField(key string, field string, value string) error {
	err := common.RedisHSetField(tokenCacheKey(key), field, value)
	if err != nil {
		return err
	}
	return nil
}

// CacheGetTokenByKey 从缓存中获取 token，如果缓存中不存在，则从数据库中获取
func cacheGetTokenByKey(key string) (*Token, error) {
	if !common.RedisEnabled {
		return nil, fmt.Errorf("redis is not enabled")
	}
	var token Token
	err := common.RedisHGetObj(tokenCacheKey(key), &token)
	if err != nil {
		return nil, err
	}
	token.Key = key
	return &token, nil
}
