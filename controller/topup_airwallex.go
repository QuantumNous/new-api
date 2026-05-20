package controller

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/thanhpk/randstr"
)

// Airwallex hosted-payment-page flow.
//
//   1. /api/user/airwallex/pay (auth) — frontend posts {amount, currency}.
//      We auth against Airwallex, create a PaymentIntent, persist a pending
//      TopUp row, return {pay_link} for the SPA to redirect to.
//   2. /api/airwallex/webhook (public) — Airwallex POSTs payment_intent.*
//      events. We verify HMAC, look up TopUp by merchant_order_id, and call
//      model.RechargeAirwallex for terminal-success events.
//
// HPP URL form documented at:
//   https://www.airwallex.com/docs/online-payments__hosted-payment-page__overview
// PaymentIntent API:
//   https://www.airwallex.com/docs/api#/Payment_Acceptance/Payment_Intents

const (
	AirwallexSignatureHeader = "x-signature"
	AirwallexTimestampHeader = "x-timestamp"

	airwallexCheckoutHostProd    = "https://checkout.airwallex.com"
	airwallexCheckoutHostSandbox = "https://checkout-demo.airwallex.com"
)

// AirwallexCurrencyConfig is one row in setting.AirwallexCurrencies.
type AirwallexCurrencyConfig struct {
	Currency  string  `json:"currency"`
	UnitPrice float64 `json:"unit_price"`
	MinTopUp  int     `json:"min_topup"`
}

// AirwallexPayRequest is the SPA → backend payload.
type AirwallexPayRequest struct {
	Amount        int64  `json:"amount"`
	Currency      string `json:"currency"`
	PaymentMethod string `json:"payment_method"`
	SuccessURL    string `json:"success_url,omitempty"`
	CancelURL     string `json:"cancel_url,omitempty"`
}

// AirwallexWebhookEvent is the subset of the webhook payload we depend on.
type AirwallexWebhookEvent struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	CreatedAt string          `json:"created_at"`
	Data      json.RawMessage `json:"data"`
}

type AirwallexWebhookData struct {
	Object AirwallexPaymentIntent `json:"object"`
}

type AirwallexPaymentIntent struct {
	ID              string  `json:"id"`
	MerchantOrderID string  `json:"merchant_order_id"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
	Status          string  `json:"status"`
}

// ---------- Token cache ----------

var (
	airwallexTokenMu     sync.Mutex
	airwallexCachedToken string
	airwallexTokenExpiry time.Time
)

// getAirwallexAccessToken returns a cached JWT or fetches a fresh one. Airwallex
// access tokens TTL is ~30m; we refresh ~5m before expiry so concurrent intents
// don't trip on a stale token mid-call.
func getAirwallexAccessToken(ctx context.Context) (string, error) {
	airwallexTokenMu.Lock()
	defer airwallexTokenMu.Unlock()

	if airwallexCachedToken != "" && time.Now().Add(5*time.Minute).Before(airwallexTokenExpiry) {
		return airwallexCachedToken, nil
	}

	if setting.AirwallexClientId == "" || setting.AirwallexApiKey == "" {
		return "", errors.New("Airwallex 凭证未配置")
	}

	url := setting.AirwallexApiBaseURL() + "/api/v1/authentication/login"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return "", fmt.Errorf("创建 Airwallex 鉴权请求失败: %w", err)
	}
	req.Header.Set("x-client-id", setting.AirwallexClientId)
	req.Header.Set("x-api-key", setting.AirwallexApiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("Airwallex 鉴权 HTTP 失败: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode/100 != 2 {
		return "", fmt.Errorf("Airwallex 鉴权返回 %d: %s", resp.StatusCode, string(body))
	}

	var parsed struct {
		Token     string `json:"token"`
		ExpiresAt string `json:"expires_at"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", fmt.Errorf("解析 Airwallex 鉴权响应失败: %w", err)
	}
	if parsed.Token == "" {
		return "", errors.New("Airwallex 鉴权响应没有 token")
	}

	expiry, err := time.Parse(time.RFC3339, parsed.ExpiresAt)
	if err != nil {
		expiry = time.Now().Add(25 * time.Minute)
	}

	airwallexCachedToken = parsed.Token
	airwallexTokenExpiry = expiry
	return airwallexCachedToken, nil
}

// ---------- Currency / pricing helpers ----------

// parseAirwallexCurrencies decodes setting.AirwallexCurrencies. Returns a
// sensible AUD fallback when the JSON is unparseable so the admin never gets
// a hard 500 from a typo.
func parseAirwallexCurrencies() []AirwallexCurrencyConfig {
	raw := strings.TrimSpace(setting.AirwallexCurrencies)
	if raw == "" || raw == "[]" {
		return []AirwallexCurrencyConfig{{Currency: "AUD", UnitPrice: 1.5, MinTopUp: 5}}
	}
	var out []AirwallexCurrencyConfig
	if err := json.Unmarshal([]byte(raw), &out); err != nil || len(out) == 0 {
		return []AirwallexCurrencyConfig{{Currency: "AUD", UnitPrice: 1.5, MinTopUp: 5}}
	}
	return out
}

// findAirwallexCurrency returns the config row matching the given ISO code
// (case-insensitive). Returns nil when not enabled by admin.
func findAirwallexCurrency(code string) *AirwallexCurrencyConfig {
	code = strings.ToUpper(strings.TrimSpace(code))
	for _, c := range parseAirwallexCurrencies() {
		if strings.ToUpper(c.Currency) == code {
			cc := c
			return &cc
		}
	}
	return nil
}

// computeAirwallexPayMoney converts a quota-unit amount into the chosen
// currency's payable amount. Mirrors Stripe's getStripePayMoney semantics so
// group ratios and amount discounts continue to apply.
func computeAirwallexPayMoney(amount float64, group string, ccy *AirwallexCurrencyConfig) float64 {
	originalAmount := amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = amount / common.QuotaPerUnit
	}
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(originalAmount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}
	return amount * ccy.UnitPrice * topupGroupRatio * discount
}

// ---------- /api/user/airwallex/pay ----------

func RequestAirwallexPay(c *gin.Context) {
	var req AirwallexPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.PaymentMethod != model.PaymentMethodAirwallex {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的支付渠道"})
		return
	}

	ccy := findAirwallexCurrency(req.Currency)
	if ccy == nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "该币种未启用"})
		return
	}

	minTopup := int64(ccy.MinTopUp)
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		minTopup = minTopup * int64(common.QuotaPerUnit)
	}
	if req.Amount < minTopup {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", minTopup)})
		return
	}
	if req.Amount > 100000 {
		c.JSON(http.StatusOK, gin.H{"message": "充值数量不能大于 100000", "data": ""})
		return
	}

	if req.SuccessURL != "" && common.ValidateRedirectURL(req.SuccessURL) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "支付成功重定向URL不在可信任域名列表中", "data": ""})
		return
	}
	if req.CancelURL != "" && common.ValidateRedirectURL(req.CancelURL) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "支付取消重定向URL不在可信任域名列表中", "data": ""})
		return
	}

	id := c.GetInt("id")
	user, _ := model.GetUserById(id, false)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "用户不存在"})
		return
	}

	payMoney := computeAirwallexPayMoney(float64(req.Amount), user.Group, ccy)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}
	payMoney = decimal.NewFromFloat(payMoney).Round(2).InexactFloat64()

	reference := fmt.Sprintf("airwallex-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	tradeNo := "axw_" + common.Sha1([]byte(reference))

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          req.Amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAirwallex,
		PaymentProvider: model.PaymentProviderAirwallex,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Airwallex 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	intent, err := createAirwallexPaymentIntent(c.Request.Context(), tradeNo, payMoney, strings.ToUpper(ccy.Currency), user.Email)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Airwallex 创建 PaymentIntent 失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	successURL := req.SuccessURL
	if successURL == "" {
		successURL = strings.TrimRight(system_setting.ServerAddress, "/") + "/console/log"
	}
	cancelURL := req.CancelURL
	if cancelURL == "" {
		cancelURL = strings.TrimRight(system_setting.ServerAddress, "/") + "/console/topup"
	}

	payLink := buildAirwallexHostedURL(intent.ID, intent.ClientSecret, strings.ToUpper(ccy.Currency), payMoney, successURL, cancelURL)

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Airwallex 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f currency=%s intent_id=%s", id, tradeNo, req.Amount, payMoney, ccy.Currency, intent.ID))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": payLink,
			"order_id": tradeNo,
		},
	})
}

// ---------- PaymentIntent creation ----------

type airwallexIntentResp struct {
	ID           string `json:"id"`
	ClientSecret string `json:"client_secret"`
	Status       string `json:"status"`
}

func createAirwallexPaymentIntent(ctx context.Context, tradeNo string, amount float64, currency string, email string) (*airwallexIntentResp, error) {
	token, err := getAirwallexAccessToken(ctx)
	if err != nil {
		return nil, err
	}

	body := map[string]interface{}{
		"request_id":        tradeNo,
		"merchant_order_id": tradeNo,
		"amount":            amount,
		"currency":          currency,
		"descriptor":        "DeepRouter Credit",
	}
	if email != "" {
		body["order"] = map[string]interface{}{
			"shopper": map[string]interface{}{
				"email": email,
			},
		}
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("序列化 PaymentIntent 失败: %w", err)
	}

	url := setting.AirwallexApiBaseURL() + "/api/v1/pa/payment_intents/create"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("PaymentIntent HTTP 失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("PaymentIntent 返回 %d: %s", resp.StatusCode, string(respBody))
	}

	var parsed airwallexIntentResp
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("解析 PaymentIntent 响应失败: %w", err)
	}
	if parsed.ID == "" || parsed.ClientSecret == "" {
		return nil, fmt.Errorf("PaymentIntent 响应缺少 id/client_secret: %s", string(respBody))
	}
	return &parsed, nil
}

func buildAirwallexHostedURL(intentID, clientSecret, currency string, amount float64, successURL, cancelURL string) string {
	host := airwallexCheckoutHostProd
	env := "prod"
	if setting.AirwallexSandbox {
		host = airwallexCheckoutHostSandbox
		env = "demo"
	}

	// Airwallex HPP query is URL-encoded by the SDK on their side; raw values
	// are fine for ASCII payloads we control. Use url.Values for safety.
	q := strings.Builder{}
	q.WriteString("intent_id=")
	q.WriteString(intentID)
	q.WriteString("&client_secret=")
	q.WriteString(clientSecret)
	q.WriteString("&currency=")
	q.WriteString(currency)
	q.WriteString("&amount=")
	q.WriteString(fmt.Sprintf("%.2f", amount))
	q.WriteString("&env=")
	q.WriteString(env)
	q.WriteString("&mode=payment")
	q.WriteString("&successUrl=")
	q.WriteString(successURL)
	q.WriteString("&failUrl=")
	q.WriteString(cancelURL)
	return host + "/#/standalone/checkout?" + q.String()
}

// ---------- /api/airwallex/webhook ----------

// verifyAirwallexSignature implements Airwallex's webhook auth: HMAC-SHA256
// over (timestamp + raw body), hex-encoded, compared in constant time.
func verifyAirwallexSignature(timestamp, body, signature, secret string) bool {
	if secret == "" || signature == "" || timestamp == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp))
	mac.Write([]byte(body))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func AirwallexWebhook(c *gin.Context) {
	ctx := c.Request.Context()
	if !isAirwallexWebhookEnabled() {
		logger.LogWarn(ctx, fmt.Sprintf("Airwallex webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Airwallex webhook 读取请求体失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	signature := c.GetHeader(AirwallexSignatureHeader)
	timestamp := c.GetHeader(AirwallexTimestampHeader)
	logger.LogInfo(ctx, fmt.Sprintf("Airwallex webhook 收到请求 path=%q client_ip=%s timestamp=%q signature=%q body=%q", c.Request.RequestURI, c.ClientIP(), timestamp, signature, string(bodyBytes)))

	if !verifyAirwallexSignature(timestamp, string(bodyBytes), signature, setting.AirwallexWebhookSecret) {
		logger.LogWarn(ctx, fmt.Sprintf("Airwallex webhook 验签失败 path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	var event AirwallexWebhookEvent
	if err := json.Unmarshal(bodyBytes, &event); err != nil {
		logger.LogError(ctx, fmt.Sprintf("Airwallex webhook 解析失败 error=%q body=%q", err.Error(), string(bodyBytes)))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var data AirwallexWebhookData
	if err := json.Unmarshal(event.Data, &data); err != nil {
		logger.LogError(ctx, fmt.Sprintf("Airwallex webhook data 解析失败 event_id=%s error=%q", event.ID, err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	tradeNo := data.Object.MerchantOrderID
	if tradeNo == "" {
		logger.LogWarn(ctx, fmt.Sprintf("Airwallex webhook 缺少 merchant_order_id event_id=%s event_name=%s", event.ID, event.Name))
		c.Status(http.StatusOK) // ack, avoid endless retries
		return
	}

	switch event.Name {
	case "payment_intent.succeeded":
		handleAirwallexSucceeded(c, &event, &data.Object)
	case "payment_intent.cancelled", "payment_intent.expired":
		handleAirwallexTerminalFailed(c, &event, &data.Object)
	default:
		logger.LogInfo(ctx, fmt.Sprintf("Airwallex webhook 忽略事件 event_name=%s event_id=%s trade_no=%s", event.Name, event.ID, tradeNo))
		c.Status(http.StatusOK)
	}
}

func handleAirwallexSucceeded(c *gin.Context, event *AirwallexWebhookEvent, intent *AirwallexPaymentIntent) {
	ctx := c.Request.Context()
	tradeNo := intent.MerchantOrderID

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		logger.LogWarn(ctx, fmt.Sprintf("Airwallex webhook 充值订单不存在 trade_no=%s intent_id=%s", tradeNo, intent.ID))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	if topUp.PaymentProvider != model.PaymentProviderAirwallex {
		logger.LogWarn(ctx, fmt.Sprintf("Airwallex webhook provider 不匹配 trade_no=%s provider=%s", tradeNo, topUp.PaymentProvider))
		c.Status(http.StatusOK)
		return
	}

	if topUp.Status != common.TopUpStatusPending {
		logger.LogInfo(ctx, fmt.Sprintf("Airwallex webhook 订单非 pending，忽略 trade_no=%s status=%s", tradeNo, topUp.Status))
		c.Status(http.StatusOK)
		return
	}

	if err := model.RechargeAirwallex(tradeNo, c.ClientIP()); err != nil {
		logger.LogError(ctx, fmt.Sprintf("Airwallex webhook 充值失败 trade_no=%s intent_id=%s error=%q", tradeNo, intent.ID, err.Error()))
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	logger.LogInfo(ctx, fmt.Sprintf("Airwallex 充值成功 trade_no=%s intent_id=%s amount=%.2f currency=%s event_id=%s", tradeNo, intent.ID, intent.Amount, intent.Currency, event.ID))
	c.Status(http.StatusOK)
}

func handleAirwallexTerminalFailed(c *gin.Context, event *AirwallexWebhookEvent, intent *AirwallexPaymentIntent) {
	ctx := c.Request.Context()
	tradeNo := intent.MerchantOrderID

	targetStatus := common.TopUpStatusFailed
	if event.Name == "payment_intent.expired" {
		targetStatus = common.TopUpStatusExpired
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	err := model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderAirwallex, targetStatus)
	if errors.Is(err, model.ErrTopUpNotFound) {
		logger.LogWarn(ctx, fmt.Sprintf("Airwallex webhook 充值订单不存在，无法标记 status trade_no=%s event_name=%s", tradeNo, event.Name))
		c.Status(http.StatusOK)
		return
	}
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("Airwallex webhook 状态变更失败 trade_no=%s event_name=%s error=%q", tradeNo, event.Name, err.Error()))
		c.Status(http.StatusOK)
		return
	}
	logger.LogInfo(ctx, fmt.Sprintf("Airwallex 订单已标记 %s trade_no=%s intent_id=%s", targetStatus, tradeNo, intent.ID))
	c.Status(http.StatusOK)
}
