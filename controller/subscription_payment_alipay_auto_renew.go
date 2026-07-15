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

// SubscriptionRequestAlipayAutoRenew starts 支付并签约: first-period page/wap pay + cycle agreement in one redirect.
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
	now := time.Now()
	periodRule, err := service.BuildAlipayPeriodRuleFromPlan(plan, singleAmount, now)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	signupReference := "sub-ali-ar-" + common.Sha1([]byte(fmt.Sprintf("%d-%d-%s", user.Id, plan.Id, randstr.String(12))))
	// Alipay external_agreement_no max length is 32.
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

	outTradeNo, _, _, err := service.PrepareAlipayAutoRenewFirstPeriod(contract, plan, now)
	if err != nil {
		if !reusedPending {
			_ = model.MarkPendingAutoRenewSignupFailed(contract.Id)
		}
		common.ApiError(c, err)
		return
	}

	method := service.GetAlipayPayMethod(c.Request)
	returnURL := getSubscriptionAlipayReturnURL(req.ReturnURL)
	notifyURL := getSubscriptionAlipayNotifyURL()
	payURL, err := service.BuildAlipayPayAndSignURL(service.AlipayPayAndSignRequest{
		Method:              method,
		OutTradeNo:          outTradeNo,
		TotalAmount:         singleAmount,
		Subject:             fmt.Sprintf("Subscription %s", plan.Title),
		ReturnURL:           returnURL,
		NotifyURL:           notifyURL,
		QuitURL:             returnURL,
		ExternalAgreementNo: signupReference,
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
		logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay pay-and-sign URL failed user_id=%d plan_id=%d error=%q", userId, plan.Id, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentStartFailed)})
		return
	}

	// Short query only for this first-period out_trade_no (not mid-cycle polling).
	if err := service.EnsureAlipayAutoRenewChargePendingTask(outTradeNo); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay pay-and-sign enqueue pending query failed out_trade_no=%s error=%q", outTradeNo, err.Error()))
	}

	// Bill list: pending as soon as pay-and-sign is opened (trade_no = first-period out_trade_no).
	snapshot := buildPaymentSnapshot(plan.PriceAmount, payMoney, "CNY")
	if err := model.EnsurePendingAutoRenewTopUp(user.Id, outTradeNo, payMoney, snapshot, model.PaymentMethodAlipay, model.PaymentProviderAlipay); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay auto-renew pending topup failed user_id=%d out_trade_no=%s error=%q", userId, outTradeNo, err.Error()))
	}

	common.ApiSuccess(c, gin.H{
		"pay_type":         "redirect",
		"checkout_url":     payURL,
		"pay_url":          payURL,
		"signup_reference": signupReference,
		"out_trade_no":     outTradeNo,
		"trade_no":         outTradeNo,
		"mode":             "pay_and_sign",
	})
}

// handleAlipayAutoRenewAgreementNotify processes agreement sign / unsign async notifications.
// For 支付并签约, first-period money is already collected via the pay notify — do not charge again.
func handleAlipayAutoRenewAgreementNotify(c *gin.Context, normalized map[string]string) bool {
	externalAgreementNo := strings.TrimSpace(normalized["external_agreement_no"])
	agreementNo := strings.TrimSpace(normalized["agreement_no"])
	status := strings.ToUpper(strings.TrimSpace(normalized["status"]))
	if externalAgreementNo == "" && agreementNo == "" {
		return false
	}

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

	// Pay-and-sign: first period is the page/wap payment. Never charge first period again here.
	// If payment notify already fulfilled, contract may already be active; CompleteAutoRenewSignup keeps status.
	// If payment is still pending, leave pending_first_charge until trade notify / short query settles.
	c.String(http.StatusOK, "success")
	return true
}

// handleAlipayAutoRenewTradeNotify fulfills the first-period pay-and-sign payment or a later cycle charge.
func handleAlipayAutoRenewTradeNotify(c *gin.Context, normalized map[string]string, outTradeNo string) bool {
	if outTradeNo == "" || !strings.HasPrefix(outTradeNo, "aliar") {
		return false
	}
	if !service.IsAlipayTradeSuccess(normalized["trade_status"]) {
		c.String(http.StatusOK, "success")
		return true
	}

	// If agreement_no is present on trade notify (some products attach it), bind early.
	if agreementNo := strings.TrimSpace(normalized["agreement_no"]); agreementNo != "" {
		external := strings.TrimSpace(normalized["external_agreement_no"])
		if external != "" {
			_ = model.CompleteAutoRenewSignup(
				model.PaymentProviderAlipay,
				external,
				agreementNo,
				firstNonEmpty(normalized["buyer_id"], normalized["buyer_user_id"]),
				common.GetJsonString(normalized),
			)
		}
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
