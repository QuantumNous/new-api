package service

import (
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

// recordModelQuotaFromContext reads the model quota usage IDs from gin context
// and asynchronously records the actual quota consumption.
// This is a non-blocking observation hook — it does NOT affect billing.
func recordModelQuotaFromContext(c *gin.Context, actualQuota int) {
	if actualQuota == 0 {
		return
	}
	val, exists := c.Get("model_quota_usage_ids")
	if !exists {
		return
	}
	usageIds, ok := val.([]int)
	if !ok || len(usageIds) == 0 {
		return
	}
	gopool.Go(func() {
		RecordModelQuotaUsage(usageIds, actualQuota)
	})
}
