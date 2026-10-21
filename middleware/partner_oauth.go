package middleware

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const (
	partnerOAuthPrincipalKey         = "partner_oauth_principal"
	partnerOAuthRateStyleOAuth       = "oauth"
	partnerOAuthRateStyleIntegration = "integration"
)

func PartnerOAuthRequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetString(common.RequestIdKey)
		if id != "" {
			c.Header("X-Request-Id", id)
		}
		c.Next()
	}
}

func PartnerOAuthNoStore() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.Header("Pragma", "no-cache")
		c.Next()
	}
}

func PartnerOAuthRateLimit(mark string, max int, windowSeconds int64, style string) gin.HandlerFunc {
	if max <= 0 || windowSeconds <= 0 {
		return defNext
	}
	if common.RedisEnabled {
		return func(c *gin.Context) {
			allowed, _, ttlSeconds, err := redisFixedWindowTake(
				c.Request.Context(),
				redisIPRateLimitKey(mark, c.ClientIP()),
				max,
				windowSeconds,
			)
			if err != nil {
				logger.LogError(c.Request.Context(), "partner oauth rate limit failed: "+err.Error())
				c.Status(http.StatusInternalServerError)
				c.Abort()
				return
			}
			if !allowed {
				writePartnerOAuthRateLimited(c, ttlSeconds, style)
			}
		}
	}
	inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
	return func(c *gin.Context) {
		key := mark + c.ClientIP()
		if !inMemoryRateLimiter.Request(key, max, windowSeconds) {
			writePartnerOAuthRateLimited(c, windowSeconds, style)
		}
	}
}

func PartnerOAuthClientAuthLimited(c *gin.Context, clientID string) bool {
	clientID = strings.TrimSpace(clientID)
	if clientID == "" {
		return false
	}
	limited := false
	usedRedis := false
	if common.RedisEnabled {
		allowed, _, _, err := redisFixedWindowTake(c.Request.Context(), redisIPRateLimitKey("POA-CLIENT-FAIL", clientID), 10, 300)
		if err == nil {
			limited = !allowed
			usedRedis = true
		}
	}
	if !usedRedis {
		inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
		limited = !inMemoryRateLimiter.Request("POA-CLIENT-FAIL:"+clientID, 10, 300)
	}
	if !limited {
		return false
	}
	writePartnerOAuthRateLimited(c, 300, partnerOAuthRateStyleOAuth)
	return true
}

func writePartnerOAuthRateLimited(c *gin.Context, retryAfterSeconds int64, style string) {
	if retryAfterSeconds > 0 {
		c.Header("Retry-After", strconv.FormatInt(retryAfterSeconds, 10))
	}
	id := c.GetString(common.RequestIdKey)
	c.Header("X-Request-Id", id)
	c.Header("Cache-Control", "no-store")
	if style == partnerOAuthRateStyleIntegration {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":      gin.H{"code": "rate_limited", "message": "too many requests"},
			"request_id": id,
		})
	} else {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":             "rate_limited",
			"error_description": "too many requests",
		})
	}
	c.Abort()
}

func PartnerOAuthBearer(requiredScope string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.URL.Query().Has("access_token") {
			writePartnerIntegrationError(c, http.StatusBadRequest, "invalid_request", "access_token must not be sent in the query", "")
			return
		}
		header := strings.TrimSpace(c.GetHeader("Authorization"))
		if header == "" {
			c.Header("WWW-Authenticate", `Bearer realm="integration"`)
			c.Status(http.StatusUnauthorized)
			c.Abort()
			return
		}
		parts := strings.Fields(header)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || parts[1] == "" {
			writePartnerIntegrationError(c, http.StatusUnauthorized, "invalid_token", "access token is invalid", `Bearer realm="integration", error="invalid_token"`)
			return
		}
		raw := parts[1]
		principal, err := service.AuthenticatePartnerOAuthAccessToken(raw, requiredScope)
		if err != nil {
			typed := service.AsPartnerOAuthError(err)
			if typed == nil {
				writePartnerIntegrationError(c, http.StatusInternalServerError, "server_error", "please try again later", "")
				return
			}
			www := typed.WWWAuth
			if www == "" && typed.Code == "invalid_token" {
				www = `Bearer realm="integration", error="invalid_token"`
			}
			writePartnerIntegrationError(c, typed.Status, typed.Code, typed.Description, www)
			return
		}
		c.Set(partnerOAuthPrincipalKey, principal)
		c.Next()
	}
}

func PartnerOAuthPrincipal(c *gin.Context) *service.PartnerOAuthAccessPrincipal {
	value, ok := c.Get(partnerOAuthPrincipalKey)
	if !ok {
		return nil
	}
	principal, _ := value.(*service.PartnerOAuthAccessPrincipal)
	return principal
}

func writePartnerIntegrationError(c *gin.Context, status int, code, message, www string) {
	if www != "" {
		c.Header("WWW-Authenticate", www)
	}
	id := c.GetString(common.RequestIdKey)
	c.Header("X-Request-Id", id)
	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
	c.JSON(status, gin.H{
		"error": gin.H{
			"code":    code,
			"message": message,
		},
		"request_id": id,
	})
	c.Abort()
}
