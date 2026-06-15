package controller

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const oidcLogoutTokenTTL = 30 * time.Minute

// oidcLogoutTokens stores ID tokens when Redis is unavailable.
var oidcLogoutTokens sync.Map

// oidcLogoutTokenEntry holds an ID token and its fallback-cache expiry time.
type oidcLogoutTokenEntry struct {
	token     string
	expiresAt time.Time
}

func init() {
	go cleanupExpiredOIDCLogoutTokens()
}

// storeOIDCLogoutToken stores an ID token and returns an opaque lookup key.
func storeOIDCLogoutToken(idToken string) string {
	key := common.GetRandomString(32)
	if common.RedisEnabled && common.RDB != nil {
		if err := common.RedisSet(oidcLogoutTokenCacheKey(key), idToken, oidcLogoutTokenTTL); err == nil {
			return key
		}
	}

	oidcLogoutTokens.Store(key, oidcLogoutTokenEntry{
		token:     idToken,
		expiresAt: time.Now().Add(oidcLogoutTokenTTL),
	})
	return key
}

// cleanupExpiredOIDCLogoutTokens periodically removes expired fallback entries.
func cleanupExpiredOIDCLogoutTokens() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		oidcLogoutTokens.Range(func(key, value any) bool {
			entry, ok := value.(oidcLogoutTokenEntry)
			if !ok || now.After(entry.expiresAt) {
				oidcLogoutTokens.Delete(key)
			}
			return true
		})
	}
}

// loadOIDCLogoutToken loads an ID token without consuming it.
func loadOIDCLogoutToken(key string) string {
	if key == "" {
		return ""
	}

	cacheKey := oidcLogoutTokenCacheKey(key)
	if common.RedisEnabled && common.RDB != nil {
		token, err := common.RedisGet(cacheKey)
		if err == nil {
			return token
		}
	}

	value, ok := oidcLogoutTokens.Load(key)
	if !ok {
		return ""
	}
	entry, ok := value.(oidcLogoutTokenEntry)
	if !ok || time.Now().After(entry.expiresAt) {
		return ""
	}
	return entry.token
}

// deleteOIDCLogoutToken removes a cached ID token after logout succeeds.
func deleteOIDCLogoutToken(key string) {
	if key == "" {
		return
	}

	if common.RedisEnabled && common.RDB != nil {
		_ = common.RedisDel(oidcLogoutTokenCacheKey(key))
	}
	oidcLogoutTokens.Delete(key)
}

// oidcLogoutTokenCacheKey builds the Redis key for an OIDC logout token.
func oidcLogoutTokenCacheKey(key string) string {
	return "oidc_logout_token:" + key
}
