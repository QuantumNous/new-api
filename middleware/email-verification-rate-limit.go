package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

const (
	EmailVerificationRateLimitMark = "EV"
	EmailVerificationMaxRequests   = 2  // 30秒内最多2次
	EmailVerificationDuration      = 30 // 30秒时间窗口
	APIKeyRecoveryRateLimitMark    = "AKR"
	APIKeyRecoveryMaxRequests      = 3 // 每个邮箱十分钟内最多3次
	APIKeyRecoveryDuration         = 10 * 60
)

func redisEmailVerificationRateLimiter(c *gin.Context) {
	allowed, _, ttlSeconds, err := redisFixedWindowTake(
		c.Request.Context(),
		redisIPRateLimitKey(EmailVerificationRateLimitMark, c.ClientIP()),
		EmailVerificationMaxRequests,
		EmailVerificationDuration,
	)
	if err != nil {
		memoryEmailVerificationRateLimiter(c)
		return
	}
	if allowed {
		c.Next()
		return
	}

	waitSeconds := int64(EmailVerificationDuration)
	if ttlSeconds > 0 {
		waitSeconds = ttlSeconds
	}

	c.JSON(http.StatusTooManyRequests, gin.H{
		"success": false,
		"message": fmt.Sprintf("发送过于频繁，请等待 %d 秒后再试", waitSeconds),
	})
	c.Abort()
}

func memoryEmailVerificationRateLimiter(c *gin.Context) {
	key := EmailVerificationRateLimitMark + ":" + c.ClientIP()

	if !inMemoryRateLimiter.Request(key, EmailVerificationMaxRequests, EmailVerificationDuration) {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"success": false,
			"message": "发送过于频繁，请稍后再试",
		})
		c.Abort()
		return
	}

	c.Next()
}

func EmailVerificationRateLimit() gin.HandlerFunc {
	// Keep the fallback ready before requests arrive so a concurrent Redis
	// outage cannot race the in-memory limiter's first initialization.
	inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
	return func(c *gin.Context) {
		if common.RedisEnabled {
			redisEmailVerificationRateLimiter(c)
		} else {
			memoryEmailVerificationRateLimiter(c)
		}
	}
}

// APIKeyRecoveryRateLimit adds an account/email dimension to the IP limiter.
// The email is HMACed before it enters a Redis key so addresses are never
// persisted in the rate-limit namespace.
func APIKeyRecoveryRateLimit() gin.HandlerFunc {
	inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
	return func(c *gin.Context) {
		email := strings.ToLower(strings.TrimSpace(c.Query("email")))
		if email == "" {
			c.Next()
			return
		}
		emailHash := common.GenerateHMACWithKey([]byte("api-key-recovery-rate-v1:"+common.SessionSecret), email)
		key := redisIPRateLimitKey(APIKeyRecoveryRateLimitMark, emailHash)
		if common.RedisEnabled {
			allowed, _, ttl, err := redisFixedWindowTake(c.Request.Context(), key, APIKeyRecoveryMaxRequests, APIKeyRecoveryDuration)
			if err == nil {
				if allowed {
					c.Next()
					return
				}
				if ttl <= 0 {
					ttl = APIKeyRecoveryDuration
				}
				c.Header("Retry-After", fmt.Sprintf("%d", ttl))
				c.JSON(http.StatusTooManyRequests, gin.H{"success": false, "message": "发送过于频繁，请稍后再试"})
				c.Abort()
				return
			}
		}
		if !inMemoryRateLimiter.Request(APIKeyRecoveryRateLimitMark+":"+emailHash, APIKeyRecoveryMaxRequests, APIKeyRecoveryDuration) {
			c.Header("Retry-After", fmt.Sprintf("%d", APIKeyRecoveryDuration))
			c.JSON(http.StatusTooManyRequests, gin.H{"success": false, "message": "发送过于频繁，请稍后再试"})
			c.Abort()
			return
		}
		c.Next()
	}
}
