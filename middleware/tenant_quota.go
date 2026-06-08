package middleware

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	tenantquota "github.com/QuantumNous/new-api/internal/quota"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// TenantQuotaCheck enforces per-token RPM / TPM / monthly limits at the relay
// entry point, before any upstream call is made.
//
// On limit breach it returns HTTP 429 with error code "tenant_quota_exceeded"
// and aborts — no retry is attempted (distinct from upstream 503 / DRS-17).
//
// Behaviour when Redis is unavailable: falls back to in-process memory limits.
// All checks are skipped when the token has zero limits (unlimited).
func TenantQuotaCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenID := common.GetContextKeyInt(c, constant.ContextKeyTokenId)
		if tokenID == 0 {
			c.Next()
			return
		}

		// Use cached lookup (fromDB=false) — token was already loaded by TokenAuth,
		// so this hits Redis cache, not the database.
		tokenKey := common.GetContextKeyString(c, constant.ContextKeyTokenKey)
		token, err := model.GetTokenByKey(tokenKey, false)
		if err != nil || token == nil {
			c.Next()
			return
		}

		// All limits zero means unlimited; skip the Redis round-trips entirely
		if token.RpmLimit == 0 && token.TpmLimit == 0 && token.MonthlyLimit == 0 {
			c.Next()
			return
		}

		ctx := c.Request.Context()
		var rdb = common.RDB
		if !common.RedisEnabled {
			rdb = nil
		}

		// RPM check
		if token.RpmLimit > 0 {
			allowed, err := tenantquota.CheckRPM(ctx, rdb, tokenID, token.RpmLimit)
			if err != nil {
				// Fail open on Redis error — log and continue
				common.SysLog(fmt.Sprintf("TenantQuotaCheck RPM error token=%d: %v", tokenID, err))
			} else if !allowed {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests,
					fmt.Sprintf("rpm limit reached (%d req/min)", token.RpmLimit),
					types.ErrorCodeTenantQuotaExceeded)
				return
			}
		}

		// TPM check — use pre-computed estimate if available, otherwise fall back
		// to a rough approximation from Content-Length (1 token ≈ 4 bytes).
		if token.TpmLimit > 0 {
			estimated := common.GetContextKeyInt(c, constant.ContextKeyEstimatedTokens)
			if estimated == 0 {
				if cl := c.Request.ContentLength; cl > 0 {
					estimated = int(cl / 4)
				}
				if estimated == 0 {
					estimated = 1 // minimum so TPM is never skipped entirely
				}
			}
			allowed, err := tenantquota.CheckTPM(ctx, rdb, tokenID, token.TpmLimit, estimated)
			if err != nil {
				common.SysLog(fmt.Sprintf("TenantQuotaCheck TPM error token=%d: %v", tokenID, err))
			} else if !allowed {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests,
					fmt.Sprintf("tpm limit reached (%d tokens/min)", token.TpmLimit),
					types.ErrorCodeTenantQuotaExceeded)
				return
			}
		}

		// Monthly check
		if token.MonthlyLimit > 0 {
			allowed, err := tenantquota.CheckMonthly(ctx, rdb, tokenID, token.MonthlyLimit)
			if err != nil {
				common.SysLog(fmt.Sprintf("TenantQuotaCheck monthly error token=%d: %v", tokenID, err))
			} else if !allowed {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests,
					fmt.Sprintf("monthly limit reached (%d req/month)", token.MonthlyLimit),
					types.ErrorCodeTenantQuotaExceeded)
				return
			}
		}

		c.Next()
	}
}
