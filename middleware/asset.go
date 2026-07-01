package middleware

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

// AssetRateLimit rate-limits the asset endpoints per user, configured from the
// system settings (either threshold being <=0 disables it).
// It must be used after TokenAuth (it depends on the user id in the context).
func AssetRateLimit() func(c *gin.Context) {
	return func(c *gin.Context) {
		cfg := &system_setting.VolcAssetConfig
		maxCount := cfg.RateLimitCount
		duration := int64(cfg.RateLimitDurationSeconds)
		if maxCount <= 0 || duration <= 0 {
			c.Next()
			return
		}
		userId := c.GetInt("id")
		if userId == 0 {
			c.Next()
			return
		}
		if common.RedisEnabled {
			userRedisRateLimiter(c, maxCount, duration, fmt.Sprintf("rateLimit:VASSET:user:%d", userId))
			if c.IsAborted() {
				return
			}
			c.Next()
			return
		}
		inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
		if !inMemoryRateLimiter.Request(fmt.Sprintf("VASSET:user:%d", userId), maxCount, duration) {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "asset operation rate limit exceeded"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// AssetGroupAdminOnly restricts the asset group management endpoints to admins only.
// Regular users' groups are managed automatically by the system and group CRUD is
// not exposed, to preserve the "one user, one group" isolation invariant.
func AssetGroupAdminOnly() func(c *gin.Context) {
	return func(c *gin.Context) {
		userId := c.GetInt("id")
		if userId == 0 || !model.IsAdmin(userId) {
			c.JSON(http.StatusForbidden, gin.H{"error": "asset group management requires admin privileges"})
			c.Abort()
			return
		}
		c.Next()
	}
}
