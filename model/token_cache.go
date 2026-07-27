package model

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
)

// Version the hash namespace so newly added Token fields cannot be read as
// zero values from hashes written by an older binary.
const tokenCacheKeyPrefix = "token:v2:"

func cacheSetToken(token Token) error {
	key := common.GenerateHMAC(token.Key)
	token.Clean()
	err := common.RedisHSetObj(tokenCacheKeyPrefix+key, &token, time.Duration(common.RedisKeyCacheSeconds())*time.Second)
	if err != nil {
		return err
	}
	return nil
}

func cacheDeleteToken(key string) error {
	key = common.GenerateHMAC(key)
	err := common.RedisDelKey(tokenCacheKeyPrefix + key)
	if err != nil {
		return err
	}
	return nil
}

func cacheIncrTokenQuota(key string, increment int64) error {
	key = common.GenerateHMAC(key)
	err := common.RedisHIncrBy(tokenCacheKeyPrefix+key, constant.TokenFiledRemainQuota, increment)
	if err != nil {
		return err
	}
	return nil
}

func cacheDecrTokenQuota(key string, decrement int64) error {
	return cacheIncrTokenQuota(key, -decrement)
}

func cacheSetTokenField(key string, field string, value string) error {
	key = common.GenerateHMAC(key)
	err := common.RedisHSetField(tokenCacheKeyPrefix+key, field, value)
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
	err := common.RedisHGetObj(tokenCacheKeyPrefix+hmacKey, &token)
	if err != nil {
		return nil, err
	}
	token.Key = key
	return &token, nil
}
