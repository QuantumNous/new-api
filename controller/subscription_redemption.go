package controller

import (
	"fmt"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

type createSubscriptionRedemptionsRequest struct {
	PlanId      int    `json:"plan_id"`
	BatchName   string `json:"batch_name"`
	Count       int    `json:"count"`
	ExpiredTime int64  `json:"expired_time"`
}

type revokeSubscriptionRedemptionsRequest struct {
	Keys []string `json:"keys"`
}

func redemptionKeyHint(key string) string {
	key = strings.TrimSpace(key)
	if len(key) <= 6 {
		return "***"
	}
	return "***" + key[len(key)-6:]
}

// RedeemCode is the single user-facing redemption endpoint. The server owns
// code-type dispatch so the console never has to ask users whether a bearer
// credential contains wallet credit or a subscription.
func RedeemCode(c *gin.Context) {
	id := c.GetInt("id")
	lock := getTopUpLock(id)
	if !lock.TryLock() {
		common.ApiErrorI18n(c, i18n.MsgUserTopUpProcessing)
		return
	}
	defer lock.Unlock()

	req := topUpRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(req.Key) == "" {
		common.ApiErrorI18n(c, i18n.MsgRedeemFailed)
		return
	}

	if model.IsSubscriptionRedemptionKey(req.Key) {
		result, err := model.RedeemSubscription(req.Key, id)
		if err != nil {
			common.ApiErrorI18n(c, i18n.MsgRedeemFailed)
			logger.LogError(c, fmt.Sprintf("failed to redeem subscription key %s for user %d: %s", redemptionKeyHint(req.Key), id, err.Error()))
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data": gin.H{
				"kind":         "subscription",
				"plan_id":      result.PlanId,
				"plan_title":   result.PlanTitle,
				"subscription": result.Subscription,
			},
		})
		return
	}

	quota, err := model.Redeem(req.Key, id)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgRedeemFailed)
		logger.LogError(c, fmt.Sprintf("failed to redeem wallet key %s for user %d: %s", redemptionKeyHint(req.Key), id, err.Error()))
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"kind":  "balance",
			"quota": quota,
		},
	})
}

func AdminCreateSubscriptionRedemptions(c *gin.Context) {
	if !operation_setting.IsPaymentComplianceConfirmed() {
		common.ApiErrorI18n(c, i18n.MsgPaymentComplianceRequired)
		return
	}

	var req createSubscriptionRedemptionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	req.BatchName = strings.TrimSpace(req.BatchName)
	if req.PlanId <= 0 || utf8.RuneCountInString(req.BatchName) == 0 || utf8.RuneCountInString(req.BatchName) > 64 {
		common.ApiErrorMsg(c, "invalid plan or batch name")
		return
	}
	if req.Count <= 0 || req.Count > 1000 {
		common.ApiErrorMsg(c, "count must be between 1 and 1000")
		return
	}
	if req.ExpiredTime != 0 && req.ExpiredTime < common.GetTimestamp() {
		common.ApiErrorMsg(c, "expiration time is in the past")
		return
	}

	result, err := model.CreateSubscriptionRedemptions(c.GetInt("id"), req.BatchName, req.PlanId, req.Count, req.ExpiredTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "subscription_redemption.create", map[string]interface{}{
		"plan_id":      result.PlanId,
		"plan_title":   result.PlanTitle,
		"batch_name":   result.BatchName,
		"count":        len(result.Codes),
		"expired_time": result.ExpiresAt,
	})
	common.ApiSuccess(c, result)
}

func AdminRevokeSubscriptionRedemptions(c *gin.Context) {
	var req revokeSubscriptionRedemptionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if len(req.Keys) == 0 || len(req.Keys) > 1000 {
		common.ApiErrorMsg(c, "keys must contain between 1 and 1000 codes")
		return
	}
	count, err := model.DisableSubscriptionRedemptions(req.Keys)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "subscription_redemption.revoke", map[string]interface{}{
		"requested_count": len(req.Keys),
		"revoked_count":   count,
	})
	common.ApiSuccess(c, gin.H{"revoked_count": count})
}
