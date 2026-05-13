package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
)

const opsBillingSnapshotFrom = "new-api"

// PublishBillingSnapshotForOpsLog stores reconciled token usage and consume quota on the Gin context
// so outer ops middleware (e.g. Lynxton relay_request_summary) can emit them after c.Next().
// Safe with zeros when totals are unknown. Last call in a request wins.
func PublishBillingSnapshotForOpsLog(c *gin.Context, promptTokens, completionTokens, totalTokens, consumeQuota int) {
	if c == nil {
		return
	}
	common.SetContextKey(c, constant.ContextKeyOpsBillingPromptTokens, promptTokens)
	common.SetContextKey(c, constant.ContextKeyOpsBillingCompletionTokens, completionTokens)
	common.SetContextKey(c, constant.ContextKeyOpsBillingTotalTokens, totalTokens)
	common.SetContextKey(c, constant.ContextKeyOpsBillingConsumeQuota, consumeQuota)
	common.SetContextKey(c, constant.ContextKeyOpsBillingSnapshotFrom, opsBillingSnapshotFrom)
}
