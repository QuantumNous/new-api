package model

import (
	"fmt"
	"one-api/common"
	"sync"
	"time"
)

var revokedMem sync.Map // jti -> exp(unix)

func RevokeToken(jti string, exp int64) error {
	if jti == "" {
		return nil
	}
	// Prefer Redis, else in-memory
	if common.RedisEnabled {
		ttl := time.Duration(0)
		if exp > 0 {
			ttl = time.Until(time.Unix(exp, 0))
		}
		if ttl <= 0 {
			ttl = time.Minute
		}
		key := fmt.Sprintf("oauth:revoked:%s", jti)
		return common.RedisSet(key, "1", ttl)
	}
	if exp <= 0 {
		exp = time.Now().Add(time.Minute).Unix()
	}
	revokedMem.Store(jti, exp)
	return nil
}

func IsTokenRevoked(jti string) (bool, error) {
	if jti == "" {
		return false, nil
	}
	if common.RedisEnabled {
		key := fmt.Sprintf("oauth:revoked:%s", jti)
		if _, err := common.RedisGet(key); err == nil {
			return true, nil
		} else {
			// Not found or error; treat as not revoked on error to avoid hard failures
			return false, nil
		}
	}
	// In-memory check
	if v, ok := revokedMem.Load(jti); ok {
		exp, _ := v.(int64)
		if exp == 0 || time.Now().Unix() <= exp {
			return true, nil
		}
		revokedMem.Delete(jti)
	}
	return false, nil
}
