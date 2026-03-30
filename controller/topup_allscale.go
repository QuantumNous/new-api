package controller

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/thanhpk/randstr"
)

// AllScale checkout intent numeric status codes
const (
	allScaleCheckoutStatusFailed    = -1
	allScaleCheckoutStatusRejected  = -2
	allScaleCheckoutStatusUnderpaid = -3
	allScaleCheckoutStatusCanceled  = -4
	allScaleCheckoutStatusCreated   = 1
	allScaleCheckoutStatusConfirmed = 20
)

// ── outgoing request signing ─────────────────────────────────────────────────

func allScaleSha256Hex(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

func allScaleSign(secret string, canonical []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(canonical)
	return "v1=" + base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

// buildAllScaleRequestHeaders signs a request to the AllScale API and returns
// the four auth headers ready to set on the outgoing http.Request.
func buildAllScaleRequestHeaders(method, path, query string, body []byte) (apiKey, timestamp, nonce, signature string) {
	apiKey = setting.AllScaleApiKey
	timestamp = fmt.Sprintf("%d", time.Now().Unix())
	nonce = uuid.New().String()
	bodyHash := allScaleSha256Hex(body)
	canonical := []byte(strings.Join([]string{
		strings.ToUpper(method), path, query, timestamp, nonce, bodyHash,
	}, "\n"))
	signature = allScaleSign(setting.AllScaleApiSecret, canonical)
	return
}

const maxAllScaleWebhookBody = 64 << 10 // 64 KiB

// ── webhook signature verification ──────────────────────────────────────────

// verifyAllScaleWebhook verifies the HMAC-SHA256 signature AllScale sends on
// every webhook callback (domain-separated from the request signing scheme).
func verifyAllScaleWebhook(requestPath, queryString, webhookId, timestamp, nonce string, body []byte, sigHeader string) bool {
	if setting.AllScaleApiSecret == "" {
		log.Printf("AllScale webhook secret not configured")
		return false
	}
	if setting.AllScaleWebhookID != "" && webhookId != setting.AllScaleWebhookID {
		log.Printf("AllScale webhook: webhook_id mismatch (got=%s, want=%s)", webhookId, setting.AllScaleWebhookID)
		return false
	}
	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		log.Printf("AllScale webhook: invalid timestamp format")
		return false
	}
	now := time.Now().Unix()
	if now-ts > 300 || ts-now > 60 {
		log.Printf("AllScale webhook: timestamp outside acceptable window (ts=%d, now=%d)", ts, now)
		return false
	}
	bodyHash := allScaleSha256Hex(body)
	canonical := []byte(strings.Join([]string{
		"allscale:webhook:v1",
		"POST",
		requestPath,
		queryString,
		webhookId,
		timestamp,
		nonce,
		bodyHash,
	}, "\n"))
	expected := allScaleSign(setting.AllScaleApiSecret, canonical)
	return hmac.Equal([]byte(expected), []byte(sigHeader))
}

// ── pay-money calculation ────────────────────────────────────────────────────

func getAllScalePayMoney(amount float64, group string) float64 {
	originalAmount := amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = amount / common.QuotaPerUnit
	}
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(originalAmount)]; ok && ds > 0 {
		discount = ds
	}
	return amount * topupGroupRatio * discount
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

type AllScalePayRequest struct {
	Amount int64 `json:"amount"`
}

// AllScale API response wrapper
type allScaleAPIResponse struct {
	Code    int    `json:"code"`
	Payload *struct {
		CheckoutURL              string `json:"checkout_url"`
		AllScaleCheckoutIntentId string `json:"allscale_checkout_intent_id"`
	} `json:"payload"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// allScaleStatusResponse is the response from GET /v1/checkout_intents/{id}/
type allScaleStatusResponse struct {
	Code    int    `json:"code"`
	Payload *struct {
		Status                   string `json:"status"` // PENDING_PAYMENT, PAID, EXPIRED, FAILED
		AllScaleCheckoutIntentId string `json:"allscale_checkout_intent_id"`
	} `json:"payload"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// AllScaleWebhookPayload mirrors WebhookCallbackPayload from callback_service.py.
type AllScaleWebhookPayload struct {
	AllScaleTransactionId    string         `json:"all_scale_transaction_id"`
	AllScaleCheckoutIntentId string         `json:"all_scale_checkout_intent_id"`
	WebhookId                string         `json:"webhook_id"`
	AmountCents              int            `json:"amount_cents"`
	Currency                 int            `json:"currency"`
	CurrencySymbol           string         `json:"currency_symbol"`
	AmountCoins              string         `json:"amount_coins"`
	CoinContractAddress      string         `json:"coin_contract_address"`
	CoinSymbol               string         `json:"coin_symbol"`
	ChainId                  int            `json:"chain_id"`
	TxHash                   string         `json:"tx_hash"`
	TxFrom                   string         `json:"tx_from"`
	PaymentMethodType        int            `json:"payment_method_type"`
	UserId                   *string        `json:"user_id"`
	OrderId                  *string        `json:"order_id"` // our tradeNo
	UserName                 *string        `json:"user_name"`
	ExtraObj                 map[string]any `json:"extra_obj"`
}

// ── handlers ─────────────────────────────────────────────────────────────────

// RequestAllScalePay creates an AllScale checkout intent and returns the
// checkout_url for the user to complete payment in crypto (USDT/USDC).
func RequestAllScalePay(c *gin.Context) {
	if !setting.AllScaleEnabled {
		c.JSON(200, gin.H{"message": "error", "data": "AllScale payment is not enabled"})
		return
	}
	if setting.AllScaleApiKey == "" || setting.AllScaleApiSecret == "" {
		c.JSON(200, gin.H{"message": "error", "data": "AllScale payment is not configured"})
		return
	}

	var req AllScalePayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "invalid request"})
		return
	}
	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil || user == nil {
		c.JSON(200, gin.H{"message": "error", "data": "user not found"})
		return
	}

	group, _ := model.GetUserGroup(userId, true)
	payMoney := getAllScalePayMoney(float64(req.Amount), group)

	// Apply currency rate and round early so the minimum check uses the actual USD charge.
	unitPrice := setting.AllScaleUnitPrice
	if unitPrice <= 0 {
		unitPrice = 1.0
	}
	roundedUSD := math.Round(payMoney/unitPrice*100) / 100

	minTopUp := setting.AllScaleMinTopUp
	if minTopUp <= 0 {
		minTopUp = 1.0
	}
	if roundedUSD < minTopUp {
		c.JSON(200, gin.H{"message": "error", "data": fmt.Sprintf("minimum payment is $%.2f USD", minTopUp)})
		return
	}

	// Normalise stored amount for token-display mode (mirrors Waffo pattern).
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		quotaPerUnit := int64(common.QuotaPerUnit)
		if quotaPerUnit > 0 && req.Amount%quotaPerUnit != 0 {
			c.JSON(200, gin.H{"message": "error", "data": "token amount must be a multiple of the quota unit size"})
			return
		}
		amount = req.Amount / quotaPerUnit
		if amount < 1 {
			amount = 1
		}
	}

	tradeNo := fmt.Sprintf("ALLSCALE-%d-%d-%s", userId, time.Now().UnixMilli(), randstr.String(6))

	// Persist a pending order before calling the external API.
	topUp := &model.TopUp{
		UserId:        userId,
		Amount:        amount,
		Money:         payMoney,
		TradeNo:       tradeNo,
		PaymentMethod: "allscale",
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		log.Printf("AllScale: failed to insert TopUp: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "failed to create order"})
		return
	}

	// Build the checkout-intent request body.
	// roundedUSD and unitPrice were already computed above for the minimum check.
	amountCents := int64(math.Round(roundedUSD * 100))
	redirectURL := system_setting.ServerAddress + "/console/topup?show_history=true"

	reqBody, _ := common.Marshal(map[string]any{
		"currency":          1, // USD = 1
		"amount_cents":      amountCents,
		"order_id":          tradeNo, // reconciliation key returned in webhook
		"user_id":           fmt.Sprintf("%d", userId),
		"user_name":         user.Username,
		"order_description": fmt.Sprintf("Top up %d credits", req.Amount),
		"redirect_url":      redirectURL,
	})

	// Sign and send to AllScale API.
	apiURL := strings.TrimRight(setting.AllScaleBaseURL, "/") + "/v1/checkout_intents/"
	apiKey, ts, nonce, sig := buildAllScaleRequestHeaders("POST", "/v1/checkout_intents/", "", reqBody)

	httpReq, err := http.NewRequestWithContext(c.Request.Context(), "POST", apiURL, bytes.NewReader(reqBody))
	if err != nil {
		log.Printf("AllScale: failed to build request: %v", err)
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(200, gin.H{"message": "error", "data": "failed to initiate payment"})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-API-Key", apiKey)
	httpReq.Header.Set("X-Timestamp", ts)
	httpReq.Header.Set("X-Nonce", nonce)
	httpReq.Header.Set("X-Signature", sig)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		log.Printf("AllScale: API call failed: %v", err)
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(200, gin.H{"message": "error", "data": "failed to initiate payment"})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("AllScale: failed to read response body: %v", err)
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(200, gin.H{"message": "error", "data": "failed to read payment response"})
		return
	}

	if resp.StatusCode/100 != 2 {
		log.Printf("AllScale: API returned HTTP %d: %s", resp.StatusCode, respBody)
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(200, gin.H{"message": "error", "data": "payment gateway error"})
		return
	}

	var apiResp allScaleAPIResponse
	if err := common.Unmarshal(respBody, &apiResp); err != nil || apiResp.Code != 0 || apiResp.Payload == nil {
		errMsg := "unexpected response from payment gateway"
		if apiResp.Error != nil {
			errMsg = apiResp.Error.Message
		}
		log.Printf("AllScale: API error (code=%d): %s", apiResp.Code, errMsg)
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(200, gin.H{"message": "error", "data": errMsg})
		return
	}

	// Persist the intent ID so we can verify it on status polls (prevents replay with foreign intent IDs).
	if apiResp.Payload.AllScaleCheckoutIntentId == "" {
		log.Printf("AllScale: empty checkout intent id - tradeNo=%s", tradeNo)
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(200, gin.H{"message": "error", "data": "unexpected response from payment gateway"})
		return
	}
	topUp.CheckoutIntentId = apiResp.Payload.AllScaleCheckoutIntentId
	if err := topUp.Update(); err != nil {
		log.Printf("AllScale: failed to persist checkout intent - tradeNo=%s err=%v", tradeNo, err)
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(200, gin.H{"message": "error", "data": "failed to persist payment intent"})
		return
	}

	log.Printf("AllScale: checkout intent created - user=%d tradeNo=%s intentId=%s amount=$%.2f",
		userId, tradeNo, apiResp.Payload.AllScaleCheckoutIntentId, payMoney)

	c.JSON(200, gin.H{
		"message": "success",
		"data": gin.H{
			"checkout_url": apiResp.Payload.CheckoutURL,
			"order_id":     tradeNo,
			"intent_id":    apiResp.Payload.AllScaleCheckoutIntentId,
		},
	})
}

// AllScaleWebhook receives the payment-completed callback from AllScale and
// credits the corresponding user's quota.
func AllScaleWebhook(c *gin.Context) {
	bodyBytes, err := io.ReadAll(io.LimitReader(c.Request.Body, maxAllScaleWebhookBody+1))
	if err != nil {
		log.Printf("AllScale webhook: failed to read body: %v", err)
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if int64(len(bodyBytes)) > maxAllScaleWebhookBody {
		log.Printf("AllScale webhook: body too large (%d bytes)", len(bodyBytes))
		c.AbortWithStatus(http.StatusRequestEntityTooLarge)
		return
	}

	webhookId := c.GetHeader("X-Webhook-Id")
	timestamp := c.GetHeader("X-Webhook-Timestamp")
	nonce := c.GetHeader("X-Webhook-Nonce")
	sigHeader := c.GetHeader("X-Webhook-Signature")

	if webhookId == "" || timestamp == "" || nonce == "" || sigHeader == "" {
		log.Printf("AllScale webhook: missing required headers")
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	requestPath := c.Request.URL.Path
	queryString := c.Request.URL.RawQuery

	if !verifyAllScaleWebhook(requestPath, queryString, webhookId, timestamp, nonce, bodyBytes, sigHeader) {
		log.Printf("AllScale webhook: signature verification failed")
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	var payload AllScaleWebhookPayload
	if err := common.Unmarshal(bodyBytes, &payload); err != nil {
		log.Printf("AllScale webhook: failed to parse payload: %v", err)
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	if payload.OrderId == nil || *payload.OrderId == "" {
		log.Printf("AllScale webhook: missing order_id, intentId=%s", payload.AllScaleCheckoutIntentId)
		// Not an error on our side — acknowledge to avoid retries.
		c.Status(http.StatusOK)
		return
	}

	tradeNo := *payload.OrderId
	log.Printf("AllScale webhook: received - tradeNo=%s intentId=%s amountCents=%d coin=%s",
		tradeNo, payload.AllScaleCheckoutIntentId, payload.AmountCents, payload.CoinSymbol)

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	if err := model.RechargeAllScale(tradeNo); err != nil {
		log.Printf("AllScale webhook: recharge failed - tradeNo=%s err=%v", tradeNo, err)
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	log.Printf("AllScale webhook: recharge successful - tradeNo=%s", tradeNo)
	c.Status(http.StatusOK)
}

// RequestAllScaleAmount returns the payment amount (in USD) for a given quota
// amount, without creating an order. Used by the frontend for live price previews.
func RequestAllScaleAmount(c *gin.Context) {
	if !setting.AllScaleEnabled {
		c.JSON(200, gin.H{"message": "error", "data": "AllScale payment is not enabled"})
		return
	}
	var req AllScalePayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "invalid request"})
		return
	}
	userId := c.GetInt("id")

	// Mirror the same token-display validation as RequestAllScalePay.
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		quotaPerUnit := int64(common.QuotaPerUnit)
		if quotaPerUnit > 0 && req.Amount%quotaPerUnit != 0 {
			c.JSON(200, gin.H{"message": "error", "data": "token amount must be a multiple of the quota unit size"})
			return
		}
	}

	group, _ := model.GetUserGroup(userId, true)
	payMoney := getAllScalePayMoney(float64(req.Amount), group)
	unitPrice := setting.AllScaleUnitPrice
	if unitPrice <= 0 {
		unitPrice = 1.0
	}
	c.JSON(200, gin.H{
		"message": "success",
		"data":    strconv.FormatFloat(payMoney/unitPrice, 'f', 2, 64),
	})
}

// allScaleStatusAPIResponse is the response wrapper from GET /v1/checkout_intents/{id}/status.
// The payload is either a plain integer or {"status": int}.
type allScaleStatusAPIResponse struct {
	Code    int                 `json:"code"`
	Payload json.RawMessage     `json:"payload"`
	Error   *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// parseAllScaleNumericStatus parses the payload from the /status endpoint,
// which can be either a plain integer or {"status": int}.
func parseAllScaleNumericStatus(raw []byte) (int, error) {
	var status int
	if err := common.Unmarshal(raw, &status); err == nil {
		return status, nil
	}
	var payload struct {
		Status int `json:"status"`
	}
	if err := common.Unmarshal(raw, &payload); err == nil {
		return payload.Status, nil
	}
	return 0, fmt.Errorf("invalid allscale status payload")
}

// getAllScaleFinalTopUpStatus maps a terminal numeric status to a TopUp status string.
func getAllScaleFinalTopUpStatus(status int) string {
	switch status {
	case allScaleCheckoutStatusCanceled:
		return common.TopUpStatusExpired
	case allScaleCheckoutStatusFailed, allScaleCheckoutStatusRejected, allScaleCheckoutStatusUnderpaid:
		return common.TopUpStatusFailed
	default:
		return ""
	}
}

// GetAllScaleStatus polls the AllScale API for the checkout intent status and,
// on a successful payment, credits the user's quota.
func GetAllScaleStatus(c *gin.Context) {
	tradeNo := c.Query("trade_no")
	if tradeNo == "" {
		c.JSON(200, gin.H{"message": "error", "data": "missing trade_no"})
		return
	}

	userId := c.GetInt("id")

	// Load the order and validate ownership.
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.UserId != userId {
		c.JSON(200, gin.H{"message": "error", "data": "order not found"})
		return
	}
	if topUp.PaymentMethod != "allscale" {
		c.JSON(200, gin.H{"message": "error", "data": "order not found"})
		return
	}

	// Use the DB-stored intent ID — never trust the caller-supplied value.
	intentId := topUp.CheckoutIntentId
	if intentId == "" {
		c.JSON(200, gin.H{"message": "error", "data": "intent not found"})
		return
	}

	// Fast path: if the order is already in a terminal state, return it directly.
	if topUp.Status == common.TopUpStatusSuccess || topUp.Status == common.TopUpStatusFailed || topUp.Status == common.TopUpStatusExpired {
		localStatus := allScaleCheckoutStatusCreated
		switch topUp.Status {
		case common.TopUpStatusSuccess:
			localStatus = allScaleCheckoutStatusConfirmed
		case common.TopUpStatusFailed:
			localStatus = allScaleCheckoutStatusFailed
		case common.TopUpStatusExpired:
			localStatus = allScaleCheckoutStatusCanceled
		}
		c.JSON(200, gin.H{
			"message": "success",
			"data": gin.H{
				"status":       localStatus,
				"topup_status": topUp.Status,
				"completed":    topUp.Status == common.TopUpStatusSuccess,
			},
		})
		return
	}

	// Hit the AllScale /status endpoint for the current intent status.
	path := "/v1/checkout_intents/" + intentId + "/status"
	apiURL := strings.TrimRight(setting.AllScaleBaseURL, "/") + path
	apiKey, ts, nonce, sig := buildAllScaleRequestHeaders("GET", path, "", []byte{})

	httpReq, err := http.NewRequestWithContext(c.Request.Context(), "GET", apiURL, nil)
	if err != nil {
		log.Printf("AllScale status: failed to build request: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "failed to build request"})
		return
	}
	httpReq.Header.Set("X-API-Key", apiKey)
	httpReq.Header.Set("X-Timestamp", ts)
	httpReq.Header.Set("X-Nonce", nonce)
	httpReq.Header.Set("X-Signature", sig)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		log.Printf("AllScale status: API call failed: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "failed to contact payment gateway"})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("AllScale status: failed to read response body: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "failed to read status response"})
		return
	}

	var statusResp allScaleStatusAPIResponse
	if err := common.Unmarshal(respBody, &statusResp); err != nil || statusResp.Code != 0 {
		errMsg := "unexpected response from payment gateway"
		if statusResp.Error != nil {
			errMsg = statusResp.Error.Message
		}
		log.Printf("AllScale status: bad response for intentId=%s: %s", intentId, respBody)
		c.JSON(200, gin.H{"message": "error", "data": errMsg})
		return
	}

	status, err := parseAllScaleNumericStatus(statusResp.Payload)
	if err != nil {
		log.Printf("AllScale status: failed to parse payload for intentId=%s: %s", intentId, respBody)
		c.JSON(200, gin.H{"message": "error", "data": "failed to parse payment status"})
		return
	}

	log.Printf("AllScale status: intentId=%s tradeNo=%s status=%d", intentId, tradeNo, status)

	if status == allScaleCheckoutStatusConfirmed {
		LockOrder(tradeNo)
		defer UnlockOrder(tradeNo)
		if err := model.RechargeAllScale(tradeNo); err != nil {
			log.Printf("AllScale status poll: recharge failed - tradeNo=%s err=%v", tradeNo, err)
			c.JSON(200, gin.H{"message": "error", "data": err.Error()})
			return
		}
		c.JSON(200, gin.H{
			"message": "success",
			"data": gin.H{
				"status":       status,
				"topup_status": common.TopUpStatusSuccess,
				"completed":    true,
			},
		})
		return
	}

	if finalStatus := getAllScaleFinalTopUpStatus(status); finalStatus != "" {
		LockOrder(tradeNo)
		defer UnlockOrder(tradeNo)
		// Update local DB to reflect terminal failure.
		if tu := model.GetTopUpByTradeNo(tradeNo); tu != nil && tu.Status == common.TopUpStatusPending {
			tu.Status = finalStatus
			_ = tu.Update()
		}
		c.JSON(200, gin.H{
			"message": "success",
			"data": gin.H{
				"status":       status,
				"topup_status": finalStatus,
				"completed":    false,
			},
		})
		return
	}

	c.JSON(200, gin.H{
		"message": "success",
		"data": gin.H{
			"status":       status,
			"topup_status": common.TopUpStatusPending,
			"completed":    false,
		},
	})
}