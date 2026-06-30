package middleware

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

// AssetRateLimit 按用户对资产接口限流，配置来自系统设置（任一阈值 <=0 表示关闭）。
// 必须在 TokenAuth 之后使用（依赖上下文中的用户 id）。
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

// AssetGroupAdminOnly 限制资产分组管理接口仅管理员可调用。
// 普通用户的分组由系统自动管理，不暴露分组 CRUD，以维持「一用户一分组」的隔离不变量。
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
