package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/thanhpk/randstr"
)

type BTCPayPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

func RequestBTCPayAmount(c *gin.Context) {
	var req BTCPayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < getBTCPayMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getBTCPayMinTopup())})
		return
	}
	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getBTCPayPayMoney(float64(req.Amount), group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func RequestBTCPayPay(c *gin.Context) {
	var req BTCPayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.PaymentMethod != model.PaymentMethodBTCPay {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的支付渠道"})
		return
	}
	if req.Amount < getBTCPayMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("充值数量不能小于 %d", getBTCPayMinTopup()), "data": 10})
		return
	}
	if req.Amount > 10000 {
		c.JSON(http.StatusOK, gin.H{"message": "充值数量不能大于 10000", "data": 10})
		return
	}

	id := c.GetInt("id")
	user, _ := model.GetUserById(id, false)
	chargedMoney := GetChargedAmount(float64(req.Amount), *user)

	tradeNo := fmt.Sprintf("BTCPAY-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(6))

	checkoutURL, err := createBTCPayInvoice(tradeNo, chargedMoney)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("BTCPay 创建 Invoice 失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          req.Amount,
		Money:           chargedMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodBTCPay,
		PaymentProvider: model.PaymentProviderBTCPay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("BTCPay 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("BTCPay 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f", id, tradeNo, req.Amount, chargedMoney))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"checkout_url": checkoutURL,
		},
	})
}

func createBTCPayInvoice(tradeNo string, amount float64) (string, error) {
	serverURL := strings.TrimRight(setting.BTCPayServerURL, "/")
	storeID := setting.BTCPayStoreID
	apiKey := setting.BTCPayAPIKey

	if serverURL == "" || storeID == "" || apiKey == "" {
		return "", fmt.Errorf("BTCPay Server 配置不完整")
	}

	redirectURL := paymentReturnPath("/usage-logs")

	body := fmt.Sprintf(`{
		"amount": "%s",
		"currency": "%s",
		"metadata": {"orderId": "%s"},
		"checkout": {"redirectURL": "%s", "redirectAutomatically": true}
	}`,
		strconv.FormatFloat(amount, 'f', 2, 64),
		setting.BTCPayCurrency,
		tradeNo,
		redirectURL,
	)

	url := fmt.Sprintf("%s/api/v1/stores/%s/invoices", serverURL, storeID)
	req, err := http.NewRequest("POST", url, strings.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "token "+apiKey)

	resp, err := common.HttpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("BTCPay API 返回错误 status=%d body=%s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := common.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("BTCPay API 响应解析失败: %w", err)
	}

	checkoutLink, ok := result["checkoutLink"].(string)
	if !ok || checkoutLink == "" {
		return "", fmt.Errorf("BTCPay API 未返回 checkoutLink")
	}

	return checkoutLink, nil
}

func BTCPayWebhook(c *gin.Context) {
	ctx := c.Request.Context()
	if !isBTCPayWebhookEnabled() {
		logger.LogWarn(ctx, fmt.Sprintf("BTCPay webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("BTCPay webhook 读取请求体失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}

	signature := c.GetHeader("BTCPay-Sig")
	if !verifyBTCPayWebhookSignature(payload, signature) {
		logger.LogWarn(ctx, fmt.Sprintf("BTCPay webhook 验签失败 path=%q client_ip=%s signature=%q", c.Request.RequestURI, c.ClientIP(), signature))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var event map[string]interface{}
	if err := common.Unmarshal(payload, &event); err != nil {
		logger.LogError(ctx, fmt.Sprintf("BTCPay webhook 解析失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	eventType, _ := event["type"].(string)
	callerIp := c.ClientIP()
	logger.LogInfo(ctx, fmt.Sprintf("BTCPay webhook 收到请求 event_type=%s client_ip=%s path=%q", eventType, callerIp, c.Request.RequestURI))

	switch eventType {
	case "InvoiceSettled":
		handleBTCPayInvoiceSettled(ctx, event, callerIp)
	case "InvoiceExpired":
		handleBTCPayInvoiceExpired(ctx, event)
	case "InvoiceInvalid":
		handleBTCPayInvoiceInvalid(ctx, event, callerIp)
	default:
		logger.LogInfo(ctx, fmt.Sprintf("BTCPay webhook 忽略事件 event_type=%s client_ip=%s", eventType, callerIp))
	}

	c.Status(http.StatusOK)
}

func verifyBTCPayWebhookSignature(payload []byte, sigHeader string) bool {
	secret := setting.BTCPayWebhookSecret
	if secret == "" {
		return false
	}

	sig := strings.TrimPrefix(sigHeader, "sha256=")
	if sig == sigHeader {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expectedSig := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(sig), []byte(expectedSig))
}

func extractBTCPayOrderID(event map[string]interface{}) string {
	metadata, ok := event["metadata"].(map[string]interface{})
	if !ok {
		return ""
	}
	orderId, _ := metadata["orderId"].(string)
	return orderId
}

func handleBTCPayInvoiceSettled(ctx interface{ Value(any) any }, event map[string]interface{}, callerIp string) {
	tradeNo := extractBTCPayOrderID(event)
	if tradeNo == "" {
		logger.LogWarn(ctx, fmt.Sprintf("BTCPay InvoiceSettled 缺少 orderId client_ip=%s", callerIp))
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	err := model.RechargeBTCPay(tradeNo, callerIp)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("BTCPay 充值处理失败 trade_no=%s client_ip=%s error=%q", tradeNo, callerIp, err.Error()))
		return
	}
	logger.LogInfo(ctx, fmt.Sprintf("BTCPay 充值成功 trade_no=%s client_ip=%s", tradeNo, callerIp))
}

func handleBTCPayInvoiceExpired(ctx interface{ Value(any) any }, event map[string]interface{}) {
	tradeNo := extractBTCPayOrderID(event)
	if tradeNo == "" {
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	err := model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderBTCPay, common.TopUpStatusExpired)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("BTCPay 充值订单过期处理失败 trade_no=%s error=%q", tradeNo, err.Error()))
		return
	}
	logger.LogInfo(ctx, fmt.Sprintf("BTCPay 充值订单已过期 trade_no=%s", tradeNo))
}

func handleBTCPayInvoiceInvalid(ctx interface{ Value(any) any }, event map[string]interface{}, callerIp string) {
	tradeNo := extractBTCPayOrderID(event)
	if tradeNo == "" {
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	err := model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderBTCPay, common.TopUpStatusFailed)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("BTCPay 充值订单失败处理失败 trade_no=%s client_ip=%s error=%q", tradeNo, callerIp, err.Error()))
		return
	}
	logger.LogInfo(ctx, fmt.Sprintf("BTCPay 充值订单已标记为失败 trade_no=%s client_ip=%s", tradeNo, callerIp))
}

func getBTCPayPayMoney(amount float64, group string) float64 {
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
	dAmount := decimal.NewFromFloat(amount)
	dUnitPrice := decimal.NewFromFloat(setting.BTCPayUnitPrice)
	dGroupRatio := decimal.NewFromFloat(topupGroupRatio)
	dDiscount := decimal.NewFromFloat(discount)
	payMoney := dAmount.Mul(dUnitPrice).Mul(dGroupRatio).Mul(dDiscount)
	return payMoney.InexactFloat64()
}

func getBTCPayMinTopup() int64 {
	minTopup := setting.BTCPayMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		minTopup = minTopup * int(common.QuotaPerUnit)
	}
	return int64(minTopup)
}
