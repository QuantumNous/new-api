package middleware

import (
	"crypto/sha256"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

const (
	EmailVerificationRateLimitMark     = "EV"
	EmailVerificationIPMaxRequests     = 2
	EmailVerificationIPDuration        = 30
	EmailVerificationEmailMaxRequests  = 1
	EmailVerificationEmailCooldownSecs = 60
)

func emailVerificationRateLimitKey(email string) string {
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	digest := sha256.Sum256([]byte(normalizedEmail))
	return fmt.Sprintf("%s:email:%s:%x", redisRateLimitNamespace, EmailVerificationRateLimitMark, digest)
}

func writeEmailVerificationRateLimited(c *gin.Context, waitSeconds int64) {
	if waitSeconds <= 0 {
		waitSeconds = EmailVerificationEmailCooldownSecs
	}
	c.Header("Retry-After", strconv.FormatInt(waitSeconds, 10))
	c.JSON(http.StatusTooManyRequests, gin.H{
		"success": false,
		"message": fmt.Sprintf("发送过于频繁，请等待 %d 秒后再试", waitSeconds),
	})
	c.Abort()
}

func redisEmailVerificationRateLimiter(c *gin.Context) {
	allowed, _, ttlSeconds, err := redisFixedWindowTake(
		c.Request.Context(),
		redisIPRateLimitKey(EmailVerificationRateLimitMark, c.ClientIP()),
		EmailVerificationIPMaxRequests,
		EmailVerificationIPDuration,
	)
	if err != nil {
		memoryEmailVerificationRateLimiter(c)
		return
	}
	if !allowed {
		waitSeconds := int64(EmailVerificationIPDuration)
		if ttlSeconds > 0 {
			waitSeconds = ttlSeconds
		}
		writeEmailVerificationRateLimited(c, waitSeconds)
		return
	}

	email := strings.TrimSpace(c.Query("email"))
	if email != "" {
		allowed, _, ttlSeconds, err = redisFixedWindowTake(
			c.Request.Context(),
			emailVerificationRateLimitKey(email),
			EmailVerificationEmailMaxRequests,
			EmailVerificationEmailCooldownSecs,
		)
		if err != nil {
			memoryEmailVerificationRateLimiter(c)
			return
		}
		if !allowed {
			writeEmailVerificationRateLimited(c, ttlSeconds)
			return
		}
	}

	c.Next()
}

func memoryEmailVerificationRateLimiter(c *gin.Context) {
	key := EmailVerificationRateLimitMark + ":" + c.ClientIP()
	if !inMemoryRateLimiter.Request(key, EmailVerificationIPMaxRequests, EmailVerificationIPDuration) {
		writeEmailVerificationRateLimited(c, EmailVerificationIPDuration)
		return
	}

	email := strings.TrimSpace(c.Query("email"))
	if email != "" && !inMemoryRateLimiter.Request(
		emailVerificationRateLimitKey(email),
		EmailVerificationEmailMaxRequests,
		EmailVerificationEmailCooldownSecs,
	) {
		writeEmailVerificationRateLimited(c, EmailVerificationEmailCooldownSecs)
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
