package middleware

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// ModelQuotaLimitKey is the gin context key for model quota usage IDs
const ModelQuotaLimitKey = "model_quota_usage_ids"

// ModelQuotaLimit checks if the user has remaining model-specific quota
// before forwarding the request to upstream. It is an independent interceptor
// that does NOT participate in the billing pre-consume / settle / refund flow.
//
// After the request completes, the actual consumed quota is recorded via
// observation hooks in SettleBilling / ReturnPreConsumedQuota.
func ModelQuotaLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip if no model specified
		modelName := common.GetContextKeyString(c, constant.ContextKeyOriginalModel)
		if modelName == "" {
			c.Next()
			return
		}

		userId := c.GetInt("id")
		if userId == 0 {
			c.Next()
			return
		}

		userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)

		// Estimate pre-consume quota (conservative: use model price if available)
		preQuota := estimateModelQuota(modelName)

		// Check model quota (service layer queries subscription info and calculates periods)
		result, err := service.CheckModelQuota(userId, modelName, userGroup, preQuota)
		if err != nil {
			// On error, fail-open for availability
			common.SysError("model quota check error: " + err.Error())
			c.Next()
			return
		}

		if !result.Passed {
			abortWithOpenAiMessage(c, 403, result.ErrorMessage)
			return
		}

		// Store usage IDs for post-request recording
		if len(result.UsageIds) > 0 {
			c.Set(ModelQuotaLimitKey, result.UsageIds)
		}

		c.Next()
	}
}
