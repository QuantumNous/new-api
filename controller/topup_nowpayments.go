package controller

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/thanhpk/randstr"
)

const nowPaymentsInvoiceURL = "https://api.nowpayments.io/v1/invoice"

var nowPaymentsHTTPClient = &http.Client{Timeout: 20 * time.Second}

type NowPaymentsPayRequest struct {
	Amount int64 `json:"amount"`
}

// RequestNowPaymentsAmount returns the currency amount NOWPayments will charge.
func RequestNowPaymentsAmount(c *gin.Context) {
	var req NowPaymentsPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	minTopup := int64(setting.NowPaymentsMinTopUp)
	if req.Amount < minTopup {
		paymentError(c, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": minTopup}))
		return
	}
	id := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		paymentError(c, common.NewMessage("Failed to get the user group"))
		return
	}
	payMoney := decimal.NewFromFloat(getPayMoney(req.Amount, group)).Round(2)
	if payMoney.LessThan(decimal.NewFromFloat(0.01)) {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": payMoney.StringFixed(2)})
}

// RequestNowPaymentsPay creates a local pending order and a hosted NOWPayments
// invoice. The customer picks the coin on the hosted page.
func RequestNowPaymentsPay(c *gin.Context) {
	if !isNowPaymentsTopUpEnabled() {
		paymentError(c, common.NewMessage("NOWPayments is not enabled"))
		return
	}

	var req NowPaymentsPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	minTopup := int64(setting.NowPaymentsMinTopUp)
	if req.Amount < minTopup {
		paymentError(c, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": minTopup}))
		return
	}
	id := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}

	group, err := model.GetUserGroup(id, true)
	if err != nil {
		paymentError(c, common.NewMessage("Failed to get the user group"))
		return
	}
	payMoney := decimal.NewFromFloat(getPayMoney(req.Amount, group)).Round(2)
	if payMoney.LessThan(decimal.NewFromFloat(0.01)) {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}

	orderId := fmt.Sprintf("NWP-%d-%d-%s", id, time.Now().UnixMilli(), randstr.String(6))

	// Token display mode stores the equivalent currency amount, as Waffo does,
	// so RechargeNowPayments does not scale it a second time.
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = max(int64(float64(req.Amount)/common.QuotaPerUnit), 1)
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney.InexactFloat64(),
		TradeNo:         orderId,
		PaymentMethod:   model.PaymentMethodNowPayments,
		PaymentProvider: model.PaymentProviderNowPayments,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("NOWPayments failed to create top-up order user_id=%d trade_no=%s error=%q", id, orderId, err.Error()))
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}

	failOrder := func(reason string) {
		logger.LogError(c.Request.Context(), common.LogText("NOWPayments invoice failed user_id=%d trade_no=%s reason=%q", id, orderId, reason))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		paymentError(c, common.NewMessage("Failed to start payment"))
	}

	body, err := common.Marshal(map[string]any{
		"price_amount":        payMoney.InexactFloat64(),
		"price_currency":      setting.NowPaymentsPriceCurrency,
		"order_id":            orderId,
		"order_description":   fmt.Sprintf("Recharge %d credits", req.Amount),
		"ipn_callback_url":    service.GetCallbackAddress() + "/api/nowpayments/webhook",
		"success_url":         paymentReturnPath("/wallet?show_history=true"),
		"cancel_url":          paymentReturnPath("/wallet"),
		"is_fixed_rate":       setting.NowPaymentsFixedRate,
		"is_fee_paid_by_user": setting.NowPaymentsFeePaidByUser,
	})
	if err != nil {
		failOrder(err.Error())
		return
	}
	httpReq, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, nowPaymentsInvoiceURL, bytes.NewReader(body))
	if err != nil {
		failOrder(err.Error())
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", setting.NowPaymentsApiKey)

	resp, err := nowPaymentsHTTPClient.Do(httpReq)
	if err != nil {
		failOrder(err.Error())
		return
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		failOrder(err.Error())
		return
	}

	var invoice struct {
		InvoiceURL string `json:"invoice_url"`
	}
	if resp.StatusCode >= http.StatusMultipleChoices || common.Unmarshal(raw, &invoice) != nil || invoice.InvoiceURL == "" {
		failOrder(fmt.Sprintf("status=%d body=%s", resp.StatusCode, string(raw)))
		return
	}

	logger.LogInfo(c.Request.Context(), common.LogText("NOWPayments top-up order created user_id=%d trade_no=%s amount=%d money=%s", id, orderId, req.Amount, payMoney.StringFixed(2)))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"checkout_url": invoice.InvoiceURL,
			"order_id":     orderId,
		},
	})
}

// canonicalizeNowPaymentsJSON re-serializes a JSON document with object keys
// sorted at every level and no whitespace, keeping each scalar's original
// bytes so numbers are never round-tripped through floats. This is the form
// NOWPayments signs.
func canonicalizeNowPaymentsJSON(raw []byte, out *bytes.Buffer) error {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 {
		return errors.New("empty json value")
	}
	switch raw[0] {
	case '{':
		var fields map[string]common.RawMessage
		if err := common.Unmarshal(raw, &fields); err != nil {
			return err
		}
		keys := make([]string, 0, len(fields))
		for key := range fields {
			keys = append(keys, key)
		}
		slices.Sort(keys)
		out.WriteByte('{')
		for i, key := range keys {
			if i > 0 {
				out.WriteByte(',')
			}
			encodedKey, err := common.Marshal(key)
			if err != nil {
				return err
			}
			out.Write(encodedKey)
			out.WriteByte(':')
			if err := canonicalizeNowPaymentsJSON(fields[key], out); err != nil {
				return err
			}
		}
		out.WriteByte('}')
	case '[':
		var items []common.RawMessage
		if err := common.Unmarshal(raw, &items); err != nil {
			return err
		}
		out.WriteByte('[')
		for i, item := range items {
			if i > 0 {
				out.WriteByte(',')
			}
			if err := canonicalizeNowPaymentsJSON(item, out); err != nil {
				return err
			}
		}
		out.WriteByte(']')
	default:
		out.Write(raw)
	}
	return nil
}

// NowPaymentsWebhook handles IPN notifications. Only a signed "finished"
// notification credits the wallet; a non-2xx response makes NOWPayments retry.
func NowPaymentsWebhook(c *gin.Context) {
	if !isNowPaymentsTopUpEnabled() {
		logger.LogWarn(c.Request.Context(), common.LogText("NOWPayments webhook rejected reason=webhook_disabled client_ip=%s", c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var canonical bytes.Buffer
	if err := canonicalizeNowPaymentsJSON(bodyBytes, &canonical); err != nil {
		logger.LogWarn(c.Request.Context(), common.LogText("NOWPayments webhook invalid json client_ip=%s error=%q", c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	mac := hmac.New(sha512.New, []byte(strings.TrimSpace(setting.NowPaymentsIPNSecret)))
	mac.Write(canonical.Bytes())
	expected := hex.EncodeToString(mac.Sum(nil))
	received := strings.ToLower(strings.TrimSpace(c.GetHeader("x-nowpayments-sig")))
	if !hmac.Equal([]byte(expected), []byte(received)) {
		logger.LogWarn(c.Request.Context(), common.LogText("NOWPayments webhook signature verification failed client_ip=%s", c.ClientIP()))
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	var event struct {
		PaymentStatus string            `json:"payment_status"`
		OrderID       string            `json:"order_id"`
		PriceAmount   common.RawMessage `json:"price_amount"`
		PriceCurrency string            `json:"price_currency"`
	}
	if err := common.Unmarshal(bodyBytes, &event); err != nil || event.OrderID == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("NOWPayments webhook verified trade_no=%s status=%s client_ip=%s", event.OrderID, event.PaymentStatus, c.ClientIP()))

	switch event.PaymentStatus {
	case "finished":
		price, err := decimal.NewFromString(strings.Trim(string(event.PriceAmount), `" `))
		if err != nil {
			logger.LogError(c.Request.Context(), common.LogText("NOWPayments webhook invalid price_amount trade_no=%s", event.OrderID))
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		if err := model.RechargeNowPayments(event.OrderID, price, event.PriceCurrency, c.ClientIP()); err != nil {
			logger.LogError(c.Request.Context(), common.LogText("NOWPayments recharge failed trade_no=%s error=%q", event.OrderID, err.Error()))
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
	case "failed", "expired":
		target := common.TopUpStatusFailed
		if event.PaymentStatus == "expired" {
			target = common.TopUpStatusExpired
		}
		err := model.UpdatePendingTopUpStatus(event.OrderID, model.PaymentProviderNowPayments, target)
		if err != nil && !errors.Is(err, model.ErrTopUpStatusInvalid) && !errors.Is(err, model.ErrTopUpNotFound) {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
	case "partially_paid", "refunded":
		logger.LogWarn(c.Request.Context(), common.LogText("NOWPayments %s needs manual review trade_no=%s", event.PaymentStatus, event.OrderID))
	}
	c.Status(http.StatusOK)
}
