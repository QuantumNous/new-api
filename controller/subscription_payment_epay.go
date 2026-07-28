package controller

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

type SubscriptionEpayPayRequest struct {
	PlanId        int    `json:"plan_id"`
	PaymentMethod string `json:"payment_method"`
	RequestId     string `json:"request_id"`
	RecallClaim   string `json:"recall_claim,omitempty"`
}

func SubscriptionRequestEpay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	var req SubscriptionEpayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "invalid parameters")
		return
	}
	req.PaymentMethod = strings.TrimSpace(req.PaymentMethod)
	if !isEpayPaymentMethod(req.PaymentMethod) {
		common.ApiErrorMsg(c, "payment method does not exist")
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorMsg(c, "subscription plan is disabled")
		return
	}
	if plan.PriceAmount < 0.01 {
		common.ApiErrorMsg(c, "subscription plan amount is too low")
		return
	}

	userID := c.GetInt("id")
	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userID, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorMsg(c, "subscription plan purchase limit reached")
			return
		}
	}

	requestID := strings.TrimSpace(req.RequestId)
	if requestID == "" {
		requestID = fmt.Sprintf("legacy-epay:%d:%d:%s:%d", userID, plan.Id, req.PaymentMethod, time.Now().UnixNano())
	}
	quoteResult, err := service.QuoteSubscriptionPurchase(service.PurchaseSubscriptionCommand{
		UserID:        userID,
		PlanID:        plan.Id,
		PaymentChoice: service.SubscriptionPaymentChoiceEpay,
		PaymentMethod: req.PaymentMethod,
		Months:        1,
		RecallClaim:   strings.TrimSpace(req.RecallClaim),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if quoteResult == nil || !quoteResult.Available {
		common.ApiErrorMsg(c, "subscription purchase quote unavailable")
		return
	}
	quote := subscriptionPurchaseQuoteFromQuoteResult(quoteResult)
	result, err := service.PurchaseSubscription(service.PurchaseSubscriptionCommand{
		UserID:        userID,
		PlanID:        plan.Id,
		PaymentChoice: service.SubscriptionPaymentChoiceEpay,
		PaymentMethod: req.PaymentMethod,
		Months:        1,
		RequestID:     requestID,
		VerifiedQuote: &quote,
		RecallClaim:   strings.TrimSpace(req.RecallClaim),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if result == nil || result.Order == nil {
		common.ApiErrorMsg(c, "failed to create subscription order")
		return
	}
	order := result.Order
	if order.PaymentAmountMinor == 0 {
		completed, err := service.CompleteOneTimeEpaySubscriptionPurchase(c.Request.Context(), order.TradeNo, "zero_final_amount=true", order.PaymentMethod)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		c.JSON(http.StatusOK, subscriptionEpayPurchaseResponse(completed, paymentReturnPath("/console/topup?pay=success"), nil))
		return
	}

	callBackAddress := service.GetCallbackAddress()
	returnUrl, err := url.Parse(callBackAddress + "/api/subscription/epay/return")
	if err != nil {
		respondSubscriptionEpayFailure(c, order.TradeNo, "callback address configuration error")
		return
	}
	notifyUrl, err := url.Parse(callBackAddress + "/api/subscription/epay/notify")
	if err != nil {
		respondSubscriptionEpayFailure(c, order.TradeNo, "callback address configuration error")
		return
	}
	client := GetEpayClient()
	if client == nil {
		respondSubscriptionEpayFailure(c, order.TradeNo, "payment information is not configured")
		return
	}

	uri, params, err := client.Purchase(&epay.PurchaseArgs{
		Type:           req.PaymentMethod,
		ServiceTradeNo: order.TradeNo,
		Name:           fmt.Sprintf("SUB:%s", plan.Title),
		Money:          strconv.FormatFloat(order.Money, 'f', 2, 64),
		Device:         epay.PC,
		NotifyUrl:      notifyUrl,
		ReturnUrl:      returnUrl,
	})
	if err != nil {
		respondSubscriptionEpayFailure(c, order.TradeNo, "failed to initiate payment")
		return
	}
	c.JSON(http.StatusOK, subscriptionEpayPurchaseResponse(result, uri, params))
}

func subscriptionEpayPurchaseResponse(result *service.PurchaseSubscriptionResult, url string, params map[string]string) gin.H {
	if params == nil {
		params = map[string]string{}
	}
	response := gin.H{
		"success": true,
		"message": "success",
		"data":    params,
		"url":     url,
	}
	if result == nil {
		return response
	}
	response["status"] = result.Status
	if result.Order != nil {
		response["trade_no"] = result.Order.TradeNo
		response["payment_amount_minor"] = result.Order.PaymentAmountMinor
	}
	if result.Intent != nil {
		response["change_intent_id"] = result.Intent.Id
	}
	return response
}

func respondSubscriptionEpayFailure(c *gin.Context, tradeNo string, message string) {
	if err := service.TerminatePendingEpayPurchase(c.Request.Context(), tradeNo, model.SubscriptionChangeIntentStatusFailed); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiErrorMsg(c, message)
}

func subscriptionPurchaseQuoteFromQuoteResult(result *service.SubscriptionPurchaseQuoteResult) service.SubscriptionPurchaseQuote {
	if result == nil {
		return service.SubscriptionPurchaseQuote{}
	}
	return service.SubscriptionPurchaseQuote{
		Currency:                      result.Currency,
		UnitPrice:                     result.UnitPrice,
		UnitAmountMinor:               result.UnitAmountMinor,
		OriginalTotal:                 result.OriginalTotal,
		OriginalTotalAmountMinor:      result.OriginalTotalAmountMinor,
		DiscountKind:                  result.DiscountKind,
		DiscountAmount:                result.DiscountAmount,
		DiscountAmountMinor:           result.DiscountAmountMinor,
		Total:                         result.Total,
		PaymentAmountMinor:            result.PaymentAmountMinor,
		InvitationAvailableUSDMinor:   result.InvitationAvailableUSDMinor,
		InvitationDiscountUSDMinor:    result.InvitationDiscountUSDMinor,
		InvitationDiscountAmountMinor: result.InvitationDiscountAmountMinor,
		InvitationRemainingUSDMinor:   result.InvitationRemainingUSDMinor,
		OtherDiscountKind:             result.OtherDiscountKind,
		OtherDiscountAmountMinor:      result.OtherDiscountAmountMinor,
		RecallCampaignID:              result.RecallCampaignID,
		RecallRecipientID:             result.RecallRecipientID,
		RecallPromotionCodeID:         result.RecallPromotionCodeID,
	}
}

func SubscriptionEpayNotify(c *gin.Context) {
	var params map[string]string

	if c.Request.Method == "POST" {
		if err := c.Request.ParseForm(); err != nil {
			_, _ = c.Writer.Write([]byte("fail"))
			return
		}
		params = lo.Reduce(lo.Keys(c.Request.PostForm), func(r map[string]string, t string, i int) map[string]string {
			r[t] = c.Request.PostForm.Get(t)
			return r
		}, map[string]string{})
	} else {
		params = lo.Reduce(lo.Keys(c.Request.URL.Query()), func(r map[string]string, t string, i int) map[string]string {
			r[t] = c.Request.URL.Query().Get(t)
			return r
		}, map[string]string{})
	}

	if len(params) == 0 {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	client := GetEpayClient()
	if client == nil {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	verifyInfo, err := client.Verify(params)
	if err != nil || !verifyInfo.VerifyStatus {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if verifyInfo.TradeStatus != epay.StatusTradeSuccess {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	LockOrder(verifyInfo.ServiceTradeNo)
	defer UnlockOrder(verifyInfo.ServiceTradeNo)

	if err := completeEpaySubscriptionOrder(c.Request.Context(), verifyInfo.ServiceTradeNo, common.GetJsonString(verifyInfo), verifyInfo.Type); err != nil {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	_, _ = c.Writer.Write([]byte("success"))
}

// SubscriptionEpayReturn handles browser return after payment.
// It verifies the payload and completes the order, then redirects to console.
func SubscriptionEpayReturn(c *gin.Context) {
	var params map[string]string

	if c.Request.Method == "POST" {
		if err := c.Request.ParseForm(); err != nil {
			c.Redirect(http.StatusFound, paymentReturnPath("/console/topup?pay=fail"))
			return
		}
		params = lo.Reduce(lo.Keys(c.Request.PostForm), func(r map[string]string, t string, i int) map[string]string {
			r[t] = c.Request.PostForm.Get(t)
			return r
		}, map[string]string{})
	} else {
		params = lo.Reduce(lo.Keys(c.Request.URL.Query()), func(r map[string]string, t string, i int) map[string]string {
			r[t] = c.Request.URL.Query().Get(t)
			return r
		}, map[string]string{})
	}

	if len(params) == 0 {
		c.Redirect(http.StatusFound, paymentReturnPath("/console/topup?pay=fail"))
		return
	}

	client := GetEpayClient()
	if client == nil {
		c.Redirect(http.StatusFound, paymentReturnPath("/console/topup?pay=fail"))
		return
	}
	verifyInfo, err := client.Verify(params)
	if err != nil || !verifyInfo.VerifyStatus {
		c.Redirect(http.StatusFound, paymentReturnPath("/console/topup?pay=fail"))
		return
	}
	if verifyInfo.TradeStatus == epay.StatusTradeSuccess {
		LockOrder(verifyInfo.ServiceTradeNo)
		defer UnlockOrder(verifyInfo.ServiceTradeNo)
		if err := completeEpaySubscriptionOrder(c.Request.Context(), verifyInfo.ServiceTradeNo, common.GetJsonString(verifyInfo), verifyInfo.Type); err != nil {
			c.Redirect(http.StatusFound, paymentReturnPath("/console/topup?pay=fail"))
			return
		}
		c.Redirect(http.StatusFound, paymentReturnPath("/console/topup?pay=success"))
		return
	}
	c.Redirect(http.StatusFound, paymentReturnPath("/console/topup?pay=pending"))
}

func completeEpaySubscriptionOrder(ctx context.Context, tradeNo string, providerPayload string, actualPaymentMethod string) error {
	var order model.SubscriptionOrder
	if err := model.DB.Select("change_intent_id", "purchase_months", "subscription_discount_reservation_key").
		Where("trade_no = ? AND payment_provider = ?", tradeNo, model.PaymentProviderEpay).
		First(&order).Error; err != nil {
		return err
	}
	legacyOrder := order.ChangeIntentId <= 0 && order.PurchaseMonths == 0 && strings.TrimSpace(order.SubscriptionDiscountReservationKey) == ""
	if legacyOrder {
		return model.CompleteSubscriptionOrder(tradeNo, providerPayload, model.PaymentProviderEpay, actualPaymentMethod)
	}
	_, err := service.CompleteOneTimeEpaySubscriptionPurchase(ctx, tradeNo, providerPayload, actualPaymentMethod)
	return err
}
