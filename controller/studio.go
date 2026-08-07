package controller

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

const studioServiceModelName = "studio-task-service"

type studioServiceFeeRequest struct {
	Pts    float64 `json:"pts"`
	TaskId string  `json:"taskId"`
	JobId  string  `json:"jobId"`
	Label  string  `json:"label"`
}

// StudioImageBilling returns the authoritative, token-scoped ledger result for
// an image-auto request. It intentionally exposes no upstream route, key,
// prompt, image, or raw log metadata.
func StudioImageBilling(c *gin.Context) {
	requestID := strings.TrimSpace(c.Param("request_id"))
	if err := validateImageAutoBillingRequestID(requestID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"message": "invalid request id", "code": "invalid_request_id"},
		})
		return
	}
	userID := c.GetInt("id")
	tokenID := c.GetInt("token_id")
	if userID <= 0 || (tokenID <= 0 && !c.GetBool("studio_session")) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{"message": "token required", "code": "invalid_key"},
		})
		return
	}
	journal, err := model.GetImageAutoBillingJournalForOwner(userID, tokenID, requestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"message": "failed to read billing result", "code": "billing_lookup_failed"},
		})
		return
	}
	if journal != nil {
		chargedQuota := 0
		if journal.Status == model.ImageAutoBillingStatusSettled || journal.Status == model.ImageAutoBillingStatusSettlementPending {
			chargedQuota = journal.ActualQuota
		}
		rate := operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate
		if rate <= 0 {
			rate = 1
		}
		chargedPoints := math.Round((float64(chargedQuota)/common.QuotaPerUnit)*rate*100) / 100
		pending := journal.Status != model.ImageAutoBillingStatusSettled && journal.Status != model.ImageAutoBillingStatusRefunded
		c.JSON(http.StatusOK, gin.H{
			"found":             true,
			"pending":           pending,
			"request_id":        requestID,
			"charged_quota":     chargedQuota,
			"charged_pts":       chargedPoints,
			"settlement_status": journal.Status,
		})
		return
	}
	log, err := model.GetImageAutoConsumeLogByRequestID(userID, tokenID, requestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"message": "failed to read billing result", "code": "billing_lookup_failed"},
		})
		return
	}
	if log == nil {
		c.JSON(http.StatusAccepted, gin.H{"found": false, "pending": true, "request_id": requestID})
		return
	}
	settlementStatus := readImageAutoBillingSettlementStatus(log.Other)
	if settlementStatus == "" {
		c.JSON(http.StatusAccepted, gin.H{"found": false, "pending": true, "request_id": requestID})
		return
	}
	rate := operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate
	if rate <= 0 {
		rate = 1
	}
	chargedPoints := math.Round((float64(log.Quota)/common.QuotaPerUnit)*rate*100) / 100
	c.JSON(http.StatusOK, gin.H{
		"found":             true,
		"pending":           settlementStatus != "settled",
		"request_id":        requestID,
		"charged_quota":     log.Quota,
		"charged_pts":       chargedPoints,
		"settlement_status": settlementStatus,
	})
}

// StudioServiceFee deducts a Chimera Studio orchestration fee atomically from
// either an API-token identity or an authenticated managed session.
func StudioServiceFee(c *gin.Context) {
	var req studioServiceFeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"message": "invalid request body",
				"code":    "invalid_request",
			},
		})
		return
	}
	if req.Pts <= 0 || math.IsNaN(req.Pts) || math.IsInf(req.Pts, 0) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"message": "pts must be a positive number",
				"code":    "invalid_pts",
			},
		})
		return
	}
	req.JobId = strings.TrimSpace(req.JobId)
	req.TaskId = strings.TrimSpace(req.TaskId)
	if req.JobId == "" || len(req.JobId) > 64 || len(req.TaskId) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"message": "jobId is required and taskId/jobId must be within limits",
				"code":    "invalid_idempotency_key",
			},
		})
		return
	}

	userId := c.GetInt("id")
	tokenId := c.GetInt("token_id")
	tokenKey := c.GetString("token_key")
	studioSession := c.GetBool("studio_session")
	if userId == 0 || (!studioSession && (tokenId == 0 || tokenKey == "")) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{
				"message": "account authentication required",
				"code":    "invalid_key",
			},
		})
		return
	}

	usingGroup := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
	if usingGroup == "" {
		usingGroup = "default"
	}
	groupRatio := ratio_setting.GetGroupRatio(usingGroup)
	quota, quotaErr := studioDisplayPtsToQuota(req.Pts, groupRatio)
	if quotaErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"message": "pts is too large",
				"code":    "invalid_pts",
			},
		})
		return
	}
	if quota <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"message": "fee rounds to zero quota",
				"code":    "invalid_pts",
			},
		})
		return
	}

	rate := operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate
	if rate <= 0 {
		rate = 1
	}
	chargedPts := math.Round((float64(quota)/common.QuotaPerUnit)*rate/groupRatio*100) / 100
	charge, charged, chargeErr := model.ChargeStudioServiceFee(userId, tokenId, req.JobId, req.TaskId, quota, chargedPts)
	if chargeErr != nil {
		status := http.StatusInternalServerError
		code := "charge_failed"
		message := "failed to charge Studio service fee"
		switch {
		case errors.Is(chargeErr, model.ErrStudioServiceChargeInsufficientWallet),
			errors.Is(chargeErr, model.ErrStudioServiceChargeInsufficientToken):
			status = http.StatusPaymentRequired
			code = "insufficient_quota"
			message = "account quota is insufficient"
		case errors.Is(chargeErr, model.ErrStudioServiceChargeConflict):
			status = http.StatusConflict
			code = "idempotency_mismatch"
			message = "jobId was already used with different charge parameters"
		case errors.Is(chargeErr, model.ErrStudioServiceChargePending):
			status = http.StatusConflict
			code = "charge_state_unknown"
			message = "a prior charge attempt for this job requires manual review"
		}
		c.JSON(status, gin.H{"error": gin.H{"message": message, "code": code}})
		return
	}
	if !charged {
		c.JSON(http.StatusOK, gin.H{
			"charged_pts":   charge.ChargedPts,
			"charged_quota": charge.Quota,
			"task_id":       charge.TaskId,
			"job_id":        charge.JobId,
			"idempotent":    true,
		})
		return
	}

	model.UpdateUserUsedQuotaAndRequestCount(userId, quota)

	content := req.Label
	if content == "" {
		content = fmt.Sprintf("Studio task service fee (%s)", req.TaskId)
	}
	if req.JobId != "" {
		content = fmt.Sprintf("%s · job %s", content, req.JobId)
	}

	tokenName := c.GetString("token_name")
	other := map[string]interface{}{
		"studio_service_fee": true,
		"studio_task_id":     req.TaskId,
		"studio_job_id":      req.JobId,
		"display_pts":        req.Pts,
		"group_ratio":        groupRatio,
	}
	model.RecordConsumeLog(c, userId, model.RecordConsumeLogParams{
		ChannelId:      0,
		ModelName:      studioServiceModelName,
		TokenName:      tokenName,
		Quota:          quota,
		Content:        content,
		TokenId:        tokenId,
		UseTimeSeconds: 0,
		IsStream:       false,
		Group:          usingGroup,
		Other:          other,
	})

	c.JSON(http.StatusOK, gin.H{
		"charged_pts":   chargedPts,
		"charged_quota": quota,
		"task_id":       req.TaskId,
		"job_id":        req.JobId,
		"idempotent":    false,
	})
}

func studioDisplayPtsToQuota(pts float64, groupRatio float64) (int, error) {
	if pts <= 0 || groupRatio <= 0 {
		return 0, nil
	}
	rate := operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate
	if rate <= 0 {
		rate = 1
	}
	usd := pts / rate
	quota, clamp := common.QuotaFromDecimalChecked(decimal.NewFromFloat(usd).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		Mul(decimal.NewFromFloat(groupRatio)).
		Ceil())
	if clamp != nil {
		return 0, clamp
	}
	return quota, nil
}
