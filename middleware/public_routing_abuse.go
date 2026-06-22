package middleware

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/internal/abuse"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func PublicRoutingAbuseControl() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenID := common.GetContextKeyInt(c, constant.ContextKeyTokenId)
		tokenKey := common.GetContextKeyString(c, constant.ContextKeyTokenKey)
		if tokenID == 0 || tokenKey == "" {
			abortWithOpenAiMessage(c, http.StatusUnauthorized, "public routing credential required", types.ErrorCodeAccessDenied)
			return
		}

		var token model.Token
		err := model.DB.Where(&model.Token{Key: tokenKey}).First(&token).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				abortWithOpenAiMessage(c, http.StatusUnauthorized, "public routing credential revoked", types.ErrorCodeAccessDenied)
				return
			}
			common.SysLog(fmt.Sprintf("PublicRoutingAbuseControl token DB check failed token=%d: %v", tokenID, err))
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "public routing credential check failed")
			return
		}
		if !publicRoutingTokenUsable(&token) {
			abortWithOpenAiMessage(c, http.StatusUnauthorized, "public routing credential revoked", types.ErrorCodeAccessDenied)
			return
		}

		var rdb = common.RDB
		if !common.RedisEnabled {
			rdb = nil
		}
		decision, err := abuse.CheckPublicRoutingCredential(
			c.Request.Context(),
			rdb,
			tokenID,
			c.ClientIP(),
			c.Request.UserAgent(),
			publicRoutingAbuseConfig(),
		)
		if err != nil {
			common.SysLog(fmt.Sprintf("PublicRoutingAbuseControl check failed token=%d: %v", tokenID, err))
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "public routing abuse check failed")
			return
		}
		if !decision.Allowed {
			retryAfter := decision.RetryAfter
			if retryAfter < 1 {
				retryAfter = 1
			}
			c.Header("Retry-After", strconv.Itoa(retryAfter))
			abortWithOpenAiMessage(c, http.StatusTooManyRequests,
				fmt.Sprintf("public routing credential rate limit reached; retry after %d seconds", retryAfter),
				types.ErrorCodePublicRoutingAbuseDetected)
			return
		}
		if len(decision.Flags) > 0 {
			flags := strings.Join(decision.Flags, ",")
			common.SetContextKey(c, constant.ContextKeyPublicRoutingAbuseFlags, flags)
			c.Header("X-DeepRouter-Abuse-Flags", flags)
			common.SysLog(fmt.Sprintf("PublicRoutingAbuseControl anomaly token=%d user=%d flags=%s ip=%s", tokenID, token.UserId, flags, c.ClientIP()))
		}

		c.Next()
	}
}

func publicRoutingTokenUsable(token *model.Token) bool {
	if token == nil {
		return false
	}
	if token.Status != common.TokenStatusEnabled {
		return false
	}
	if token.ExpiredTime != -1 && token.ExpiredTime < common.GetTimestamp() {
		return false
	}
	if !token.UnlimitedQuota && token.RemainQuota <= 0 {
		return false
	}
	return true
}

func publicRoutingAbuseConfig() abuse.PublicRoutingConfig {
	cfg := abuse.DefaultConfig()
	cfg.RPMLimit = envInt("PUBLIC_ROUTING_API_RPM_LIMIT", cfg.RPMLimit)
	cfg.SharedWindowSeconds = envInt("PUBLIC_ROUTING_API_SHARED_WINDOW_SECONDS", cfg.SharedWindowSeconds)
	cfg.SharedIPLimit = envInt("PUBLIC_ROUTING_API_SHARED_IP_LIMIT", cfg.SharedIPLimit)
	cfg.SharedClientLimit = envInt("PUBLIC_ROUTING_API_SHARED_CLIENT_LIMIT", cfg.SharedClientLimit)
	return cfg
}

func envInt(name string, fallback int) int {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to parse %s: %s, using default value: %d", name, err.Error(), fallback))
		return fallback
	}
	return value
}
