package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

const (
	SmsRateLimitMark         = "SMS"
	SmsMaxRequestsPerPhone   = 1  // 1 request per 60 seconds per phone
	SmsPhoneDuration         = 60 // 60 seconds
	SmsMaxRequestsPerIP      = 5  // 5 requests per hour per IP
	SmsIPDuration            = 3600 // 1 hour
)

func redisSmsRateLimiter(c *gin.Context) {
	ctx := context.Background()
	rdb := common.RDB

	// Rate limit by phone number
	phone := c.PostForm("phone")
	if phone == "" {
		// Try to read from JSON body - will be handled in controller
		// For rate limiting, we still limit by IP
	} else {
		phoneKey := "sms:" + SmsRateLimitMark + ":phone:" + phone
		count, err := rdb.Incr(ctx, phoneKey).Result()
		if err == nil {
			if count == 1 {
				_ = rdb.Expire(ctx, phoneKey, time.Duration(SmsPhoneDuration)*time.Second).Err()
			}
			if count > int64(SmsMaxRequestsPerPhone) {
				ttl, err := rdb.TTL(ctx, phoneKey).Result()
				waitSeconds := int64(SmsPhoneDuration)
				if err == nil && ttl > 0 {
					waitSeconds = int64(ttl.Seconds())
				}
				c.JSON(http.StatusTooManyRequests, gin.H{
					"success": false,
					"message": fmt.Sprintf("发送过于频繁，请等待 %d 秒后再试", waitSeconds),
				})
				c.Abort()
				return
			}
		}
	}

	// Rate limit by IP
	ipKey := "sms:" + SmsRateLimitMark + ":ip:" + c.ClientIP()
	count, err := rdb.Incr(ctx, ipKey).Result()
	if err == nil {
		if count == 1 {
			_ = rdb.Expire(ctx, ipKey, time.Duration(SmsIPDuration)*time.Second).Err()
		}
		if count > int64(SmsMaxRequestsPerIP) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"message": "请求过于频繁，请稍后再试",
			})
			c.Abort()
			return
		}
	}

	c.Next()
}

func memorySmsRateLimiter(c *gin.Context) {
	// Rate limit by IP (in-memory fallback)
	ipKey := SmsRateLimitMark + ":ip:" + c.ClientIP()
	if !inMemoryRateLimiter.Request(ipKey, SmsMaxRequestsPerIP, SmsIPDuration) {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"success": false,
			"message": "请求过于频繁，请稍后再试",
		})
		c.Abort()
		return
	}

	c.Next()
}

func SmsRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		if common.RedisEnabled {
			redisSmsRateLimiter(c)
		} else {
			inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
			memorySmsRateLimiter(c)
		}
	}
}
