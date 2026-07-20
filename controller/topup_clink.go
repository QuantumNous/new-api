package controller

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
)

type ClinkPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
	SuccessURL    string `json:"success_url,omitempty"`
	CancelURL     string `json:"cancel_url,omitempty"`
}

type ClinkConfirmRequest struct {
	SessionID string `json:"session_id"`
}

func getClinkMinTopup() int64 {
	minTopup := setting.ClinkMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		minTopup = minTopup * int(common.QuotaPerUnit)
	}
	return int64(minTopup)
}

func getClinkSuccessURL(custom string) string {
	if strings.TrimSpace(custom) != "" {
		return custom
	}
	if strings.TrimSpace(setting.ClinkSuccessURL) != "" {
		return setting.ClinkSuccessURL
	}
	return strings.TrimRight(system_setting.ServerAddress, "/") + "/console/wallet?show_history=true"
}

func getClinkCancelURL(custom string) string {
	if strings.TrimSpace(custom) != "" {
		return custom
	}
	if strings.TrimSpace(setting.ClinkCancelURL) != "" {
		return setting.ClinkCancelURL
	}
	return strings.TrimRight(system_setting.ServerAddress, "/") + "/console/wallet"
}

func RequestClinkPay(c *gin.Context) {
	if abortIfTopupForbidden(c) {
		return
	}
	if !isClinkTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Clink 充值未启用"})
		return
	}

	var req ClinkPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgInvalidParams)})
		return
	}
	if req.PaymentMethod != "" && req.PaymentMethod != model.PaymentMethodClink {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentMethodNotExists)})
		return
	}
	if req.Amount < getClinkMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgTopupAmountMin, map[string]any{"Min": getClinkMinTopup()})})
		return
	}
	if req.Amount > 10000 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgTopupAmountMax, map[string]any{"Max": 10000})})
		return
	}
	if req.SuccessURL != "" && common.ValidateRedirectURL(req.SuccessURL) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": i18n.T(c, i18n.MsgPaymentRedirectUntrusted), "data": ""})
		return
	}
	if req.CancelURL != "" && common.ValidateRedirectURL(req.CancelURL) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": i18n.T(c, i18n.MsgPaymentRedirectUntrusted), "data": ""})
		return
	}

	id := c.GetInt("id")
	TouchUserCountry(id, c.ClientIP())
	user, err := model.GetUserById(id, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgOAuthGetUserErr)})
		return
	}

	chargedMoney := GetChargedAmount(float64(req.Amount), *user) * firstTopupPromoFactor(id, req.Amount)
	if chargedMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgTopupAmountTooLow)})
		return
	}

	tradeNo := fmt.Sprintf("CLINK-%d-%d-%s", id, time.Now().UnixMilli(), randstr.String(6))
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = amount / int64(common.QuotaPerUnit)
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           chargedMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodClink,
		PaymentProvider: model.PaymentProviderClink,
		CreateTime:      common.GetTimestamp(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.FillCountryFromIP(c.ClientIP(), user.Country).Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Clink 创建本地订单失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentCreateFailed)})
		return
	}

	currency := strings.TrimSpace(setting.ClinkCurrency)
	if currency == "" {
		currency = "USD"
	}

	session, err := service.CreateClinkCheckoutSession(c.Request.Context(), &service.ClinkCheckoutCreateRequest{
		CustomerEmail:       user.Email,
		OriginalAmount:      chargedMoney,
		OriginalCurrency:    currency,
		MerchantReferenceID: tradeNo,
		UIMode:              "hostedPage",
		SuccessURL:          getClinkSuccessURL(req.SuccessURL),
		CancelURL:           getClinkCancelURL(req.CancelURL),
		Metadata: map[string]string{
			"trade_no": tradeNo,
			"user_id":  strconv.Itoa(user.Id),
		},
	})
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Clink 创建 Checkout Session 失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderClink, common.TopUpStatusFailed)
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentStartFailed)})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Clink 充值订单创建成功 user_id=%d trade_no=%s session_id=%s amount=%.2f %s", id, tradeNo, session.SessionID, chargedMoney, currency))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"checkout_url": session.URL,
			"session_id":   session.SessionID,
			"order_id":     tradeNo,
		},
	})
}

func ConfirmClinkPay(c *gin.Context) {
	if !isClinkTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Clink 充值未启用"})
		return
	}

	var req ClinkConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.SessionID) == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgInvalidParams)})
		return
	}

	userID := c.GetInt("id")
	session, err := service.GetClinkCheckoutSession(c.Request.Context(), req.SessionID)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Clink 查询 Session 失败 user_id=%d session_id=%s error=%q", userID, req.SessionID, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentStartFailed)})
		return
	}

	if strings.ToLower(strings.TrimSpace(session.PaymentStatus)) != "paid" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentStartFailed)})
		return
	}

	tradeNo := strings.TrimSpace(session.MerchantReferenceID)
	if tradeNo == "" && session.Metadata != nil {
		tradeNo = strings.TrimSpace(session.Metadata["trade_no"])
	}
	if tradeNo == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentStartFailed)})
		return
	}

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentStartFailed)})
		return
	}
	if topUp.UserId != userID {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentStartFailed)})
		return
	}
	if topUp.Status == common.TopUpStatusSuccess {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"order_id": tradeNo, "status": "success"}})
		return
	}

	if session.AmountTotal > 0 && !service.ClinkAmountsMatch(topUp.Money, session.AmountTotal) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Clink confirm amount mismatch user_id=%d trade_no=%s expected=%.2f actual=%.2f", userID, tradeNo, topUp.Money, session.AmountTotal))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentStartFailed)})
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if err := model.RechargeClink(tradeNo, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Clink confirm 入账失败 user_id=%d trade_no=%s error=%q", userID, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentStartFailed)})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Clink confirm 入账成功 user_id=%d trade_no=%s session_id=%s", userID, tradeNo, req.SessionID))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"order_id": tradeNo,
			"status":   "success",
		},
	})
}

func ClinkWebhook(c *gin.Context) {
	if !isClinkWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Clink webhook rejected reason=disabled client_ip=%s", c.ClientIP()))
		c.String(http.StatusForbidden, "webhook disabled")
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Clink webhook read body failed client_ip=%s error=%q", c.ClientIP(), err.Error()))
		c.String(http.StatusBadRequest, "bad request")
		return
	}

	timestamp := c.GetHeader("X-Clink-Timestamp")
	signature := c.GetHeader("X-Clink-Signature")
	if !service.VerifyClinkWebhookSignature(timestamp, signature, string(bodyBytes)) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Clink webhook signature invalid client_ip=%s timestamp=%q", c.ClientIP(), timestamp))
		c.String(http.StatusUnauthorized, "invalid signature")
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Clink webhook received client_ip=%s body=%s", c.ClientIP(), string(bodyBytes)))

	if err := handleClinkWebhook(c, bodyBytes); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Clink webhook handling issue client_ip=%s error=%q body=%s", c.ClientIP(), err.Error(), string(bodyBytes)))
	}
	c.String(http.StatusOK, "OK")
}

func handleClinkWebhook(c *gin.Context, bodyBytes []byte) error {
	var event service.ClinkWebhookEvent
	if err := json.Unmarshal(bodyBytes, &event); err != nil {
		return fmt.Errorf("invalid clink webhook json: %w", err)
	}

	switch event.Type {
	case "order.succeeded":
		var order service.ClinkOrderWebhookData
		if err := json.Unmarshal(event.Data, &order); err != nil {
			return fmt.Errorf("invalid clink order payload: %w", err)
		}
		if strings.ToLower(strings.TrimSpace(order.Status)) != "success" {
			return nil
		}
		return completeClinkTopUp(c, order.MerchantReferenceID, order.AmountTotal)
	case "order.failed":
		var order service.ClinkOrderWebhookData
		if err := json.Unmarshal(event.Data, &order); err != nil {
			return fmt.Errorf("invalid clink order payload: %w", err)
		}
		return markClinkTopUpFailed(order.MerchantReferenceID)
	case "session.complete":
		var session service.ClinkSessionWebhookData
		if err := json.Unmarshal(event.Data, &session); err != nil {
			return fmt.Errorf("invalid clink session payload: %w", err)
		}
		if strings.ToLower(strings.TrimSpace(session.PaymentStatus)) != "paid" {
			return nil
		}
		return completeClinkTopUp(c, session.MerchantReferenceID, session.AmountTotal)
	default:
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("Clink webhook ignored event_type=%s", event.Type))
		return nil
	}
}

func completeClinkTopUp(c *gin.Context, tradeNo string, paidAmount float64) error {
	tradeNo = strings.TrimSpace(tradeNo)
	if tradeNo == "" {
		return fmt.Errorf("missing merchantReferenceId")
	}

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		return fmt.Errorf("topup not found trade_no=%s", tradeNo)
	}
	if paidAmount > 0 && !service.ClinkAmountsMatch(topUp.Money, paidAmount) {
		return fmt.Errorf("amount mismatch expected=%.2f actual=%.2f trade_no=%s", topUp.Money, paidAmount, tradeNo)
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	return model.RechargeClink(tradeNo, c.ClientIP())
}

func markClinkTopUpFailed(tradeNo string) error {
	tradeNo = strings.TrimSpace(tradeNo)
	if tradeNo == "" {
		return fmt.Errorf("missing merchantReferenceId")
	}
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	return model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderClink, common.TopUpStatusFailed)
}
