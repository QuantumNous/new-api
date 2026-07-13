package controller

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
)

type SubscriptionAlipayAutoRenewPayRequest struct {
	PlanId    int    `json:"plan_id"`
	ReturnURL string `json:"return_url,omitempty"`
}

func SubscriptionRequestAlipayAutoRenew(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	if !isAlipayTopUpEnabled() || !service.IsAlipayCyclePayConfigured() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentNotConfigured)})
		return
	}

	var req SubscriptionAlipayAutoRenewPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgInvalidParams)})
		return
	}
	if req.ReturnURL != "" && common.ValidateRedirectURL(req.ReturnURL) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": i18n.T(c, i18n.MsgPaymentSuccessRedirectUntrusted), "data": ""})
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorI18n(c, i18n.MsgSubscriptionNotEnabled)
		return
	}
	if plan.BillingMode != model.SubscriptionBillingModeAutoRenew {
		common.ApiErrorMsg(c, "plan is not auto_renew")
		return
	}
	if !plan.AlipayEnabled {
		common.ApiErrorMsg(c, "alipay is not enabled for this plan")
		return
	}
	if plan.PriceAmount < 0.01 {
		common.ApiErrorI18n(c, i18n.MsgPaymentAmountTooLow)
		return
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user == nil {
		common.ApiErrorI18n(c, i18n.MsgUserNotExists)
		return
	}

	payMoney := getSubscriptionAlipayMoney(plan.PriceAmount)
	if payMoney < 0.01 {
		common.ApiErrorI18n(c, i18n.MsgPaymentAmountTooLow)
		return
	}
	singleAmount := service.FormatAlipayAmount(payMoney)
	periodRule, err := service.BuildAlipayPeriodRuleFromPlan(plan, singleAmount, time.Now())
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	signupReference := "sub-ali-ar-" + common.Sha1([]byte(fmt.Sprintf("%d-%d-%s", user.Id, plan.Id, randstr.String(12))))
	// Alipay external_agreement_no max length is 32; keep a short unique reference.
	if len(signupReference) > 32 {
		signupReference = signupReference[:32]
	}

	contract, err := model.CreateOrReusePendingAutoRenewSignup(model.PaymentProviderAlipay, user.Id, plan.Id, signupReference)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	reusedPending := contract.SignupReference != signupReference
	if strings.TrimSpace(contract.SignupReference) != "" {
		signupReference = contract.SignupReference
	}

	signURL, err := service.BuildAlipayAgreementPageSignURL(service.AlipayAgreementPageSignRequest{
		ExternalAgreementNo: signupReference,
		ReturnURL:           getSubscriptionAlipayReturnURL(req.ReturnURL),
		NotifyURL:           getSubscriptionAlipayNotifyURL(),
		ExternalLogonId:     user.Username,
		SingleAmount:        periodRule.SingleAmount,
		PeriodType:          periodRule.PeriodType,
		Period:              periodRule.Period,
		ExecuteTime:         periodRule.ExecuteTime,
	})
	if err != nil {
		if !reusedPending {
			_ = model.MarkPendingAutoRenewSignupFailed(contract.Id)
		}
		logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay auto-renew sign URL failed user_id=%d plan_id=%d error=%q", userId, plan.Id, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentStartFailed)})
		return
	}

	common.ApiSuccess(c, gin.H{
		"pay_type":         "redirect",
		"checkout_url":     signURL,
		"pay_url":          signURL,
		"signup_reference": signupReference,
	})
}

// handleAlipayAutoRenewAgreementNotify processes agreement sign / unsign async notifications.
// Returns handled=true when the payload is recognized as an auto-renew agreement event.
func handleAlipayAutoRenewAgreementNotify(c *gin.Context, normalized map[string]string) bool {
	externalAgreementNo := strings.TrimSpace(normalized["external_agreement_no"])
	agreementNo := strings.TrimSpace(normalized["agreement_no"])
	status := strings.ToUpper(strings.TrimSpace(normalized["status"]))
	if externalAgreementNo == "" && agreementNo == "" {
		return false
	}

	// Prefer local lookup by signup reference; fall back to provider agreement id.
	var contract *model.BillingSubscription
	var err error
	if externalAgreementNo != "" {
		var found model.BillingSubscription
		err = model.DB.Where("provider = ? AND signup_reference = ?", model.PaymentProviderAlipay, externalAgreementNo).First(&found).Error
		if err == nil {
			contract = &found
		}
	}
	if contract == nil && agreementNo != "" {
		contract, err = model.GetBillingSubscriptionByProviderSubscriptionID(model.PaymentProviderAlipay, agreementNo)
		if err != nil {
			// Not our agreement (or not yet created) — let other handlers try.
			return false
		}
	}
	if contract == nil {
		return false
	}

	payload := common.GetJsonString(normalized)
	alipayUserID := strings.TrimSpace(normalized["alipay_user_id"])
	if alipayUserID == "" {
		alipayUserID = strings.TrimSpace(normalized["alipay_logon_id"])
	}

	// Unsign / stop
	if status == "UNSIGN" || status == "STOP" || strings.Contains(strings.ToLower(normalized["notify_type"]), "unsign") {
		_ = model.UpsertBillingSubscriptionByProviderID(&model.BillingSubscription{
			UserId:                 contract.UserId,
			PlanId:                 contract.PlanId,
			Provider:               contract.Provider,
			ProviderSubscriptionId: firstNonEmpty(agreementNo, contract.ProviderSubscriptionId),
			ProviderCustomerId:     firstNonEmpty(alipayUserID, contract.ProviderCustomerId),
			ProviderPriceId:        contract.ProviderPriceId,
			Status:                 "canceled",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     contract.CurrentPeriodStart,
			CurrentPeriodEnd:       contract.CurrentPeriodEnd,
			LastInvoiceId:          contract.LastInvoiceId,
			LastPaymentStatus:      contract.LastPaymentStatus,
			ProviderPayload:        payload,
		})
		c.String(http.StatusOK, "success")
		return true
	}

	// Sign success (NORMAL / TEMP treated as pending first charge completion)
	if agreementNo == "" {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay agreement notify missing agreement_no external=%s", externalAgreementNo))
		c.String(http.StatusBadRequest, "fail")
		return true
	}
	if err := model.CompleteAutoRenewSignup(model.PaymentProviderAlipay, contract.SignupReference, agreementNo, alipayUserID, payload); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay auto-renew complete signup failed external=%s agreement=%s error=%q", externalAgreementNo, agreementNo, err.Error()))
		c.String(http.StatusInternalServerError, "fail")
		return true
	}

	if service.IsAlipayCyclePayConfigured() {
		// Re-load after Complete so period/provider fields are current.
		if updated, err := model.GetBillingSubscriptionByProviderSubscriptionID(model.PaymentProviderAlipay, agreementNo); err == nil {
			if err := service.ChargeAlipayAutoRenewContract(c.Request.Context(), updated, getSubscriptionAlipayNotifyURL()); err != nil {
				logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay auto-renew first charge failed agreement=%s error=%q", agreementNo, err.Error()))
				// Still ack agreement notify so Alipay does not storm; due-scan/pending query can retry.
			}
		}
	}

	c.String(http.StatusOK, "success")
	return true
}

// handleAlipayAutoRenewTradeNotify fulfills a cycle charge when trade notify matches a recurring attempt.
func handleAlipayAutoRenewTradeNotify(c *gin.Context, normalized map[string]string, outTradeNo string) bool {
	if outTradeNo == "" || !strings.HasPrefix(outTradeNo, "aliar") {
		return false
	}
	if !service.IsAlipayTradeSuccess(normalized["trade_status"]) {
		// Keep attempt as failed/pending; do not invent success.
		c.String(http.StatusOK, "success")
		return true
	}

	if err := service.FinalizeAlipayAutoRenewChargeFromQuery(
		c.Request.Context(),
		outTradeNo,
		normalized["trade_status"],
		common.GetJsonString(normalized),
	); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay auto-renew trade fulfill failed out_trade_no=%s error=%q", outTradeNo, err.Error()))
		c.String(http.StatusInternalServerError, "fail")
		return true
	}
	c.String(http.StatusOK, "success")
	return true
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
