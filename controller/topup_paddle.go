package controller

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
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

const (
	paddleProdAPIBase        = "https://api.paddle.com"
	paddleSandboxAPIBase     = "https://sandbox-api.paddle.com"
	paddleAPIVersion         = "1"
	paddleSignatureTolerance = 5 * time.Second
)

type PaddlePayRequest struct {
	Amount      int64  `json:"amount"`
	GAClientID  string `json:"ga_client_id,omitempty"`
	GASessionID string `json:"ga_session_id,omitempty"`
}

type PaddleStatusRequest struct {
	TransactionID string
	OrderID       string
}

type paddleUnitPrice struct {
	Amount       string `json:"amount"`
	CurrencyCode string `json:"currency_code"`
}

type paddlePriceData struct {
	Description string          `json:"description"`
	Name        string          `json:"name"`
	ProductID   string          `json:"product_id"`
	TaxMode     string          `json:"tax_mode,omitempty"`
	UnitPrice   paddleUnitPrice `json:"unit_price"`
}

type paddleTransactionItem struct {
	Price    paddlePriceData `json:"price"`
	Quantity int             `json:"quantity"`
}

type paddleCreateTransactionRequest struct {
	Items          []paddleTransactionItem `json:"items"`
	CollectionMode string                  `json:"collection_mode"`
	Checkout       *paddleCheckoutOptions  `json:"checkout,omitempty"`
	CustomData     map[string]string       `json:"custom_data"`
}

type paddleCheckoutOptions struct {
	URL string `json:"url,omitempty"`
}

type paddleCreateTransactionResponse struct {
	Data struct {
		ID       string `json:"id"`
		Checkout struct {
			URL string `json:"url"`
		} `json:"checkout"`
	} `json:"data"`
	Error *paddleAPIError `json:"error,omitempty"`
}

type paddleAPIError struct {
	Type   string `json:"type"`
	Code   string `json:"code"`
	Detail string `json:"detail"`
}

type paddleWebhookEvent struct {
	EventType string `json:"event_type"`
	Data      struct {
		ID         string                 `json:"id"`
		Status     string                 `json:"status"`
		Currency   string                 `json:"currency_code"`
		Details    paddleWebhookDetails   `json:"details"`
		CustomData map[string]interface{} `json:"custom_data"`
	} `json:"data"`
}

type paddleWebhookDetails struct {
	Totals    paddleWebhookTotals     `json:"totals"`
	LineItems []paddleWebhookLineItem `json:"line_items"`
}

type paddleWebhookTotals struct {
	Subtotal     interface{} `json:"subtotal"`
	Total        interface{} `json:"total"`
	CurrencyCode string      `json:"currency_code"`
}

type paddleWebhookLineItem struct {
	Totals paddleWebhookTotals `json:"totals"`
}

type paddleWebhookCustomData struct {
	Kind    string
	TradeNo string
	UserID  int
}

func RequestPaddleAmount(c *gin.Context) {
	var req PaddlePayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	minTopUp := getPaddleMinTopUp()
	if req.Amount < minTopUp {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", minTopUp)})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	payMoney := getPaddlePayMoney(req.Amount, group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "data": fmt.Sprintf("%.2f", payMoney)})
}

func RequestPaddlePay(c *gin.Context) {
	if configError := paddleTopUpConfigError(); configError != "" {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Paddle 创建交易被拒绝 reason=%q sandbox=%t user_id=%d", configError, setting.EffectivePaddleSandbox(), c.GetInt("id")))
		errorMessage := "Paddle 配置不完整"
		if setting.EffectivePaddleSandbox() || c.GetInt("role") >= common.RoleAdminUser {
			errorMessage = fmt.Sprintf("Paddle 配置不完整：%s", configError)
		}
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": errorMessage})
		return
	}

	var req PaddlePayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	minTopUp := getPaddleMinTopUp()
	if req.Amount < minTopUp {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", minTopUp)})
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "用户不存在"})
		return
	}

	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	payMoney := getPaddlePayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	tradeNo := fmt.Sprintf("PADDLE-%d-%d-%s", id, time.Now().UnixMilli(), randstr.String(6))
	amount, bonusAmount := configuredTopUpAmounts(req.Amount, group)
	if amount <= 0 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值数量无效"})
		return
	}
	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		BonusAmount:     bonusAmount,
		BonusTier:       int(req.Amount),
		Money:           payMoney,
		PaymentCurrency: getPaddleCurrency(),
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodPaddle,
		PaymentProvider: model.PaymentProviderPaddle,
		GAClientID:      service.NormalizeGAIdentifier(req.GAClientID),
		GASessionID:     service.NormalizeGAIdentifier(req.GASessionID),
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paddle 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	transaction, err := createPaddleTransaction(c, tradeNo, user, req.Amount, payMoney)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paddle 创建交易失败 user_id=%d trade_no=%s sandbox=%t amount=%d money=%.2f error=%q", id, tradeNo, setting.EffectivePaddleSandbox(), req.Amount, payMoney, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		errorMessage := "拉起支付失败"
		if setting.EffectivePaddleSandbox() || c.GetInt("role") >= common.RoleAdminUser {
			errorMessage = fmt.Sprintf("Paddle 创建交易失败：%s", err.Error())
		}
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": errorMessage})
		return
	}
	if strings.TrimSpace(transaction.Data.ID) == "" {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paddle 创建交易无 transaction_id user_id=%d trade_no=%s", id, tradeNo))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	checkoutURL := normalizePaddleCheckoutURL(transaction.Data.Checkout.URL)
	if err := model.AttachPaddleGatewayTradeNo(tradeNo, id, transaction.Data.ID); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paddle 保存交易映射失败 user_id=%d trade_no=%s transaction_id=%s error=%q", id, tradeNo, transaction.Data.ID, err.Error()))
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderPaddle, common.TopUpStatusFailed)
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Paddle 充值订单创建成功 user_id=%d trade_no=%s transaction_id=%s sandbox=%t amount=%d money=%.2f", id, tradeNo, transaction.Data.ID, setting.EffectivePaddleSandbox(), req.Amount, payMoney))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"checkout_url":   checkoutURL,
			"transaction_id": transaction.Data.ID,
			"order_id":       tradeNo,
			"sandbox":        setting.EffectivePaddleSandbox(),
		},
	})
}

func GetPaddleTopUpStatus(c *gin.Context) {
	req := PaddleStatusRequest{
		TransactionID: strings.TrimSpace(c.Query("transaction_id")),
		OrderID:       strings.TrimSpace(c.Query("order_id")),
	}
	if req.TransactionID == "" && req.OrderID == "" {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	topUp, err := model.GetUserPaddleTopUpByIdentifiers(c.GetInt("id"), req.OrderID, req.TransactionID)
	if err != nil {
		common.ApiErrorMsg(c, "订单不存在")
		return
	}

	common.ApiSuccess(c, gin.H{
		"order_id":       topUp.TradeNo,
		"transaction_id": topUp.GatewayTradeNo,
		"status":         topUp.Status,
		"amount":         topUp.Amount,
		"money":          topUp.Money,
		"create_time":    topUp.CreateTime,
		"complete_time":  topUp.CompleteTime,
	})
}

func PaddleWebhook(c *gin.Context) {
	if !isPaddleWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Paddle webhook 被拒绝 reason=%q path=%q client_ip=%s", "webhook secret missing or invalid", c.Request.RequestURI, c.ClientIP()))
		c.String(http.StatusForbidden, "webhook disabled")
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paddle webhook 读取请求体失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.String(http.StatusBadRequest, "bad request")
		return
	}

	signature := c.GetHeader("Paddle-Signature")
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Paddle webhook 收到请求 path=%q client_ip=%s signature_present=%t body_size=%d", c.Request.RequestURI, c.ClientIP(), strings.TrimSpace(signature) != "", len(bodyBytes)))
	webhookSecret := strings.TrimSpace(setting.PaddleWebhookSecret)
	if err := verifyPaddleSignature(bodyBytes, signature, webhookSecret); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Paddle webhook 验签失败 path=%q client_ip=%s signature_present=%t error=%q", c.Request.RequestURI, c.ClientIP(), strings.TrimSpace(signature) != "", err.Error()))
		c.String(http.StatusUnauthorized, "invalid signature")
		return
	}

	var event paddleWebhookEvent
	if err := common.Unmarshal(bodyBytes, &event); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paddle webhook 解析失败 path=%q client_ip=%s error=%q body_size=%d", c.Request.RequestURI, c.ClientIP(), err.Error(), len(bodyBytes)))
		c.String(http.StatusBadRequest, "bad request")
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Paddle webhook 验签并解析成功 event_type=%s transaction_id=%s status=%s client_ip=%s", event.EventType, event.Data.ID, event.Data.Status, c.ClientIP()))
	if event.EventType != "transaction.paid" {
		c.String(http.StatusOK, "OK")
		return
	}
	transactionID := strings.TrimSpace(event.Data.ID)
	if transactionID == "" {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paddle webhook 缺少 transaction_id event_type=%s client_ip=%s", event.EventType, c.ClientIP()))
		c.String(http.StatusOK, "OK")
		return
	}
	if strings.ToLower(strings.TrimSpace(event.Data.Status)) != "paid" {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Paddle webhook 忽略未支付交易 event_type=%s transaction_id=%s status=%s client_ip=%s", event.EventType, event.Data.ID, event.Data.Status, c.ClientIP()))
		c.String(http.StatusOK, "OK")
		return
	}

	customData := parsePaddleWebhookCustomData(event.Data.CustomData)
	if customData.Kind != "wallet_topup" || customData.TradeNo == "" || customData.UserID <= 0 {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paddle webhook 缺少本地订单号 event_type=%s transaction_id=%s client_ip=%s", event.EventType, event.Data.ID, c.ClientIP()))
		c.String(http.StatusOK, "OK")
		return
	}

	LockOrder(customData.TradeNo)
	defer UnlockOrder(customData.TradeNo)

	topUp, err := model.GetUserPaddleTopUpByIdentifiers(customData.UserID, customData.TradeNo, "")
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paddle webhook 查询充值订单失败 trade_no=%s transaction_id=%s client_ip=%s error=%q", customData.TradeNo, transactionID, c.ClientIP(), err.Error()))
		c.String(http.StatusInternalServerError, "retry")
		return
	}
	if err := validatePaddleWebhookPayment(topUp, event); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paddle webhook 金额校验失败 trade_no=%s transaction_id=%s client_ip=%s error=%q", customData.TradeNo, transactionID, c.ClientIP(), err.Error()))
		c.String(http.StatusInternalServerError, "retry")
		return
	}

	recharged, err := model.RechargePaddle(customData.TradeNo, customData.UserID, transactionID, c.ClientIP())
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Paddle 充值处理失败 trade_no=%s transaction_id=%s client_ip=%s error=%q", customData.TradeNo, transactionID, c.ClientIP(), err.Error()))
		c.String(http.StatusInternalServerError, "retry")
		return
	}
	if recharged {
		sendPaymentSuccessGA(c.Request.Context(), model.GetTopUpByTradeNo(customData.TradeNo))
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Paddle 充值成功 trade_no=%s transaction_id=%s client_ip=%s", customData.TradeNo, transactionID, c.ClientIP()))
	c.String(http.StatusOK, "OK")
}

func createPaddleTransaction(c *gin.Context, tradeNo string, user *model.User, amount int64, payMoney float64) (*paddleCreateTransactionResponse, error) {
	currency := getPaddleCurrency()
	minorAmount, err := paddleMinorUnitAmount(payMoney, currency)
	if err != nil {
		return nil, err
	}

	payload := paddleCreateTransactionRequest{
		CollectionMode: "automatic",
		Items: []paddleTransactionItem{
			{
				Price: paddlePriceData{
					Name:        fmt.Sprintf("Wallet top-up %d", amount),
					Description: fmt.Sprintf("Wallet top-up order %s", tradeNo),
					ProductID:   strings.TrimSpace(setting.PaddleProductId),
					TaxMode:     "account_setting",
					UnitPrice: paddleUnitPrice{
						Amount:       minorAmount,
						CurrencyCode: currency,
					},
				},
				Quantity: 1,
			},
		},
		CustomData: map[string]string{
			"kind":     "wallet_topup",
			"trade_no": tradeNo,
			"user_id":  strconv.Itoa(user.Id),
		},
	}
	if checkoutURL := paddleCheckoutReturnURL(); checkoutURL != "" {
		payload.Checkout = &paddleCheckoutOptions{URL: checkoutURL}
	}
	body, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}

	url := paddleAPIBaseURL() + "/transactions"
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(setting.PaddleApiKey))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Paddle-Version", paddleAPIVersion)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var result paddleCreateTransactionResponse
	if err := common.Unmarshal(respBody, &result); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Paddle API 创建交易响应解析失败 trade_no=%s sandbox=%t status_code=%d body_size=%d error=%q", tradeNo, setting.EffectivePaddleSandbox(), resp.StatusCode, len(respBody), err.Error()))
		return nil, err
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Paddle API 创建交易响应 trade_no=%s sandbox=%t status_code=%d transaction_id=%s checkout_url_present=%t error=%s", tradeNo, setting.EffectivePaddleSandbox(), resp.StatusCode, result.Data.ID, strings.TrimSpace(result.Data.Checkout.URL) != "", formatPaddleAPIError(result.Error)))
	if resp.StatusCode/100 != 2 {
		if result.Error != nil && result.Error.Detail != "" {
			return nil, errors.New(paddleAPIErrorDetail(result.Error))
		}
		return nil, fmt.Errorf("Paddle API http status %d", resp.StatusCode)
	}
	return &result, nil
}

func getPaddlePayMoney(amount int64, group string) float64 {
	dAmount := decimal.NewFromInt(amount)
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount = dAmount.Div(decimal.NewFromFloat(common.QuotaPerUnit))
	}

	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}

	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(amount)]; ok && ds > 0 {
		discount = ds
	}

	return dAmount.
		Mul(decimal.NewFromFloat(setting.PaddleUnitPrice)).
		Mul(decimal.NewFromFloat(topupGroupRatio)).
		Mul(decimal.NewFromFloat(discount)).
		InexactFloat64()
}

func getPaddleCurrency() string {
	currency := strings.ToUpper(strings.TrimSpace(setting.PaddleCurrency))
	if currency == "" {
		return "USD"
	}
	return currency
}

func getPaddleMinTopUp() int64 {
	minTopUp := setting.PaddleMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		return decimal.NewFromInt(int64(minTopUp)).
			Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
			IntPart()
	}
	return int64(minTopUp)
}

func normalizePaddleTopUpAmount(amount int64) int64 {
	return normalizeTopUpAmount(amount)
}

func paddleAPIBaseURL() string {
	if setting.EffectivePaddleSandbox() {
		return paddleSandboxAPIBase
	}
	return paddleProdAPIBase
}

func normalizePaddleCheckoutURL(checkoutURL string) string {
	parsedURL, err := url.Parse(strings.TrimSpace(checkoutURL))
	if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
		return checkoutURL
	}
	if setting.EffectivePaddleSandbox() && parsedURL.Scheme == "https" && isLocalPaddleCheckoutHost(parsedURL.Hostname()) {
		parsedURL.Scheme = "http"
	}
	if setting.EffectivePaddleSandbox() && isLocalPaddleCheckoutHost(parsedURL.Hostname()) && parsedURL.Path == "/console/topup" {
		parsedURL.Path = "/wallet"
	}
	return parsedURL.String()
}

func paddleCheckoutReturnURL() string {
	if !setting.EffectivePaddleSandbox() {
		return ""
	}

	returnURL := strings.TrimSpace(paymentReturnPath("/console/topup"))
	parsedURL, err := url.Parse(returnURL)
	if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
		return ""
	}
	if parsedURL.Scheme == "https" || (parsedURL.Scheme == "http" && isLocalPaddleCheckoutHost(parsedURL.Hostname())) {
		return parsedURL.String()
	}
	return ""
}

func isLocalPaddleCheckoutHost(host string) bool {
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

func paddleMinorUnitAmount(amount float64, currency string) (string, error) {
	if amount <= 0 {
		return "", errors.New("invalid amount")
	}
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if currency == "" {
		currency = "USD"
	}
	scale := int32(2)
	switch currency {
	case "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF":
		scale = 0
	}
	return decimal.NewFromFloat(amount).Mul(decimal.NewFromInt(1).Shift(scale)).Round(0).StringFixed(0), nil
}

func validatePaddleWebhookPayment(topUp *model.TopUp, event paddleWebhookEvent) error {
	if topUp == nil {
		return errors.New("充值订单不存在")
	}

	expectedCurrency := strings.ToUpper(strings.TrimSpace(topUp.PaymentCurrency))
	if expectedCurrency == "" {
		expectedCurrency = getPaddleCurrency()
	}
	actualCurrency := strings.ToUpper(strings.TrimSpace(event.Data.Currency))
	totalsCurrency := strings.ToUpper(strings.TrimSpace(event.Data.Details.Totals.CurrencyCode))
	if actualCurrency == "" {
		actualCurrency = totalsCurrency
	}
	if actualCurrency == "" {
		return errors.New("Paddle webhook 缺少 currency_code")
	}
	if actualCurrency != expectedCurrency {
		return fmt.Errorf("Paddle webhook 币种不匹配 expected=%s actual=%s", expectedCurrency, actualCurrency)
	}
	if totalsCurrency != "" && totalsCurrency != expectedCurrency {
		return fmt.Errorf("Paddle webhook totals 币种不匹配 expected=%s actual=%s", expectedCurrency, totalsCurrency)
	}

	expectedSubtotal, err := paddleMinorUnitAmount(topUp.Money, expectedCurrency)
	if err != nil {
		return err
	}
	actualSubtotal, err := paddleWebhookPreTaxSubtotal(event.Data.Details)
	if err != nil {
		return err
	}
	if actualSubtotal != expectedSubtotal {
		return fmt.Errorf("Paddle webhook 金额不匹配 expected_subtotal=%s actual_pretax_subtotal=%s currency=%s", expectedSubtotal, actualSubtotal, expectedCurrency)
	}

	actualTotal, err := normalizePaddleWebhookAmount(event.Data.Details.Totals.Total)
	if err != nil {
		return err
	}
	actualTotalDecimal, err := decimal.NewFromString(actualTotal)
	if err != nil {
		return errors.New("Paddle webhook 支付金额格式错误")
	}
	expectedSubtotalDecimal, err := decimal.NewFromString(expectedSubtotal)
	if err != nil {
		return errors.New("Paddle webhook 期望金额格式错误")
	}
	if actualTotalDecimal.LessThan(expectedSubtotalDecimal) {
		return fmt.Errorf("Paddle webhook 实付金额不足 expected_min=%s actual_total=%s currency=%s", expectedSubtotal, actualTotal, expectedCurrency)
	}
	return nil
}

func paddleWebhookPreTaxSubtotal(details paddleWebhookDetails) (string, error) {
	if len(details.LineItems) == 0 {
		return normalizePaddleWebhookAmount(details.Totals.Subtotal)
	}

	total := decimal.Zero
	for _, lineItem := range details.LineItems {
		subtotal, err := normalizePaddleWebhookAmount(lineItem.Totals.Subtotal)
		if err != nil {
			return "", err
		}
		amount, err := decimal.NewFromString(subtotal)
		if err != nil {
			return "", errors.New("Paddle webhook 支付金额格式错误")
		}
		total = total.Add(amount)
	}
	return total.Round(0).StringFixed(0), nil
}

func normalizePaddleWebhookAmount(amount interface{}) (string, error) {
	switch value := amount.(type) {
	case string:
		normalized := strings.TrimSpace(value)
		if normalized == "" {
			return "", errors.New("Paddle webhook 缺少支付金额")
		}
		amount, err := decimal.NewFromString(normalized)
		if err != nil {
			return "", errors.New("Paddle webhook 支付金额格式错误")
		}
		return amount.Round(0).StringFixed(0), nil
	case float64:
		return decimal.NewFromFloat(value).Round(0).StringFixed(0), nil
	case int:
		return decimal.NewFromInt(int64(value)).StringFixed(0), nil
	case int64:
		return decimal.NewFromInt(value).StringFixed(0), nil
	default:
		return "", errors.New("Paddle webhook 缺少支付金额")
	}
}

func verifyPaddleSignature(payload []byte, header string, secret string) error {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return errors.New("webhook secret is empty")
	}
	values := parsePaddleSignatureHeader(header)
	tsValues := values["ts"]
	h1Values := values["h1"]
	if len(tsValues) == 0 || len(h1Values) == 0 {
		return errors.New("signature missing ts or h1")
	}
	ts := tsValues[0]

	timestamp, err := strconv.ParseInt(ts, 10, 64)
	if err != nil {
		return errors.New("invalid timestamp")
	}
	if delta := time.Since(time.Unix(timestamp, 0)); delta > paddleSignatureTolerance || delta < -paddleSignatureTolerance {
		return errors.New("signature timestamp outside tolerance")
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts))
	mac.Write([]byte(":"))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))
	for _, h1 := range h1Values {
		if hmac.Equal([]byte(expected), []byte(h1)) {
			return nil
		}
	}
	return errors.New("signature mismatch")
}

func parsePaddleSignatureHeader(header string) map[string][]string {
	result := map[string][]string{}
	for _, part := range strings.Split(header, ";") {
		key, value, ok := strings.Cut(strings.TrimSpace(part), "=")
		if ok {
			key = strings.TrimSpace(key)
			if key != "" {
				result[key] = append(result[key], strings.TrimSpace(value))
			}
		}
	}
	return result
}

func parsePaddleWebhookCustomData(customData map[string]interface{}) paddleWebhookCustomData {
	result := paddleWebhookCustomData{}
	if customData == nil {
		return result
	}
	if kind, ok := customData["kind"].(string); ok {
		result.Kind = strings.TrimSpace(kind)
	}
	if tradeNo, ok := customData["trade_no"].(string); ok {
		result.TradeNo = strings.TrimSpace(tradeNo)
	}
	if userID, ok := customData["user_id"].(string); ok {
		result.UserID, _ = strconv.Atoi(strings.TrimSpace(userID))
	} else if userID, ok := customData["user_id"].(float64); ok && userID > 0 {
		result.UserID = int(userID)
	}
	return result
}

func formatPaddleAPIError(apiErr *paddleAPIError) string {
	if apiErr == nil {
		return "none"
	}
	return fmt.Sprintf("type=%s code=%s detail=%s", strings.TrimSpace(apiErr.Type), strings.TrimSpace(apiErr.Code), paddleAPIErrorDetail(apiErr))
}

func paddleAPIErrorDetail(apiErr *paddleAPIError) string {
	if apiErr == nil {
		return ""
	}
	if strings.TrimSpace(apiErr.Code) == "transaction_default_checkout_url_not_set" {
		return "Paddle 账号未设置 Default Payment Link。请到 Paddle Dashboard > Checkout > Checkout settings 设置 Default Payment Link；正式环境建议指向 https://你的域名/console/topup"
	}
	return sanitizePaddleErrorDetail(apiErr.Detail)
}

func sanitizePaddleErrorDetail(detail string) string {
	detail = strings.TrimSpace(detail)
	if len(detail) > 240 {
		return detail[:240] + "..."
	}
	return detail
}
