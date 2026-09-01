package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/dodopayments/dodopayments-go"
	"github.com/dodopayments/dodopayments-go/option"
	"github.com/dodopayments/dodopayments-go/shared"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/thanhpk/randstr"
)

const dodoCurrency = "USD"

type DodoPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
	SuccessURL    string `json:"success_url,omitempty"`
	CancelURL     string `json:"cancel_url,omitempty"`
}

func RequestDodoAmount(c *gin.Context) {
	var req DodoPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	userID := c.GetInt("id")
	group, err := model.GetUserGroup(userID, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	_, payMoney, err := calculateDodoOrder(req.Amount, group)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func RequestDodoPay(c *gin.Context) {
	var req DodoPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.PaymentMethod != model.PaymentMethodDodo {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的支付渠道"})
		return
	}
	if !isDodoTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Dodo Payments 未配置"})
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

	userID := c.GetInt("id")
	user, err := model.GetUserById(userID, false)
	if err != nil || user == nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "用户不存在"})
		return
	}
	if strings.TrimSpace(user.Email) == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "请先绑定邮箱后再使用 Dodo Payments"})
		return
	}

	expectedAmount, payMoney, err := calculateDodoOrder(req.Amount, user.Group)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": err.Error()})
		return
	}
	creditedQuota, err := validateCreditedQuota(getDodoCreditedQuota(req.Amount, user.Group))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": err.Error()})
		return
	}
	if err := model.ValidateTopUpQuotaCapacity(userID, creditedQuota); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": err.Error()})
		return
	}

	client, err := newDodoClient(false)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Dodo 初始化支付客户端失败 user_id=%d error=%q", userID, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Dodo Payments 未配置"})
		return
	}
	productID := strings.TrimSpace(setting.DodoProductID)
	product, err := client.Products.Get(c.Request.Context(), productID)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Dodo 获取商品配置失败 user_id=%d product_id=%s error=%q", userID, productID, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Dodo Payments 商品校验失败"})
		return
	}
	if err := validateDodoProduct(product, productID, expectedAmount); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Dodo 商品配置无效 user_id=%d product_id=%s error=%q", userID, productID, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": err.Error()})
		return
	}

	reference := fmt.Sprintf("new-api-dodo-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	tradeNo := "dodo_" + common.Sha1([]byte(reference))
	topUp := &model.TopUp{
		UserId:          userID,
		Amount:          req.Amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodDodo,
		PaymentProvider: model.PaymentProviderDodo,
		ExpectedAmount:  expectedAmount,
		CreditedQuota:   creditedQuota,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Dodo 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", userID, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	payLink, sessionID, err := createDodoCheckout(c.Request.Context(), client, user, tradeNo, expectedAmount, req.SuccessURL, req.CancelURL)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Dodo 创建 Checkout Session 失败 user_id=%d trade_no=%s amount=%d error=%q", userID, tradeNo, req.Amount, err.Error()))
		var apiErr *dodopayments.Error
		if errors.As(err, &apiErr) && apiErr.StatusCode >= http.StatusBadRequest && apiErr.StatusCode < http.StatusInternalServerError {
			if updateErr := model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderDodo, common.TopUpStatusFailed); updateErr != nil {
				logger.LogError(c.Request.Context(), fmt.Sprintf("Dodo 标记无效 Checkout 订单失败 trade_no=%s error=%q", tradeNo, updateErr.Error()))
			}
		}
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Dodo 充值订单创建成功 user_id=%d trade_no=%s session_id=%s amount=%d expected_amount=%d", userID, tradeNo, sessionID, req.Amount, expectedAmount))
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"pay_link": payLink}})
}

func DodoWebhook(c *gin.Context) {
	ctx := c.Request.Context()
	if !isDodoWebhookEnabled() {
		logger.LogWarn(ctx, fmt.Sprintf("Dodo webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Dodo webhook 读取请求体失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}

	client, err := newDodoClient(true)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Dodo webhook 初始化失败 error=%q", err.Error()))
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	event, err := client.Webhooks.Unwrap(payload, c.Request.Header)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("Dodo webhook 验签失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	switch typedEvent := event.AsUnion().(type) {
	case dodopayments.PaymentSucceededWebhookEvent:
		if err := handleDodoPaymentSucceeded(ctx, typedEvent, c.ClientIP()); err != nil {
			logger.LogError(ctx, fmt.Sprintf("Dodo 支付成功事件处理失败 payment_id=%s client_ip=%s error=%q", typedEvent.Data.PaymentID, c.ClientIP(), err.Error()))
			c.AbortWithStatus(http.StatusUnprocessableEntity)
			return
		}
	case dodopayments.PaymentFailedWebhookEvent:
		if err := handleDodoPaymentNotSucceeded(ctx, typedEvent.BusinessID, typedEvent.Data, dodopayments.IntentStatusFailed, common.TopUpStatusFailed, c.ClientIP()); err != nil {
			logger.LogError(ctx, fmt.Sprintf("Dodo 支付失败事件处理失败 payment_id=%s client_ip=%s error=%q", typedEvent.Data.PaymentID, c.ClientIP(), err.Error()))
			c.AbortWithStatus(http.StatusUnprocessableEntity)
			return
		}
	case dodopayments.PaymentCancelledWebhookEvent:
		if err := handleDodoPaymentNotSucceeded(ctx, typedEvent.BusinessID, typedEvent.Data, dodopayments.IntentStatusCancelled, common.TopUpStatusFailed, c.ClientIP()); err != nil {
			logger.LogError(ctx, fmt.Sprintf("Dodo 支付取消事件处理失败 payment_id=%s client_ip=%s error=%q", typedEvent.Data.PaymentID, c.ClientIP(), err.Error()))
			c.AbortWithStatus(http.StatusUnprocessableEntity)
			return
		}
	default:
		logger.LogInfo(ctx, fmt.Sprintf("Dodo webhook 忽略事件 event_type=%s client_ip=%s", event.Type, c.ClientIP()))
	}
	c.Status(http.StatusOK)
}

func calculateDodoOrder(amount int64, group string) (expectedAmount int64, payMoney float64, err error) {
	if amount < getDodoMinTopUp() {
		return 0, 0, fmt.Errorf("充值数量不能小于 %d", getDodoMinTopUp())
	}
	if amount > getDodoMaxTopUp() {
		return 0, 0, fmt.Errorf("充值数量不能大于 %d", getDodoMaxTopUp())
	}
	if setting.DodoUnitPrice <= 0 || math.IsNaN(setting.DodoUnitPrice) || math.IsInf(setting.DodoUnitPrice, 0) {
		return 0, 0, errors.New("Dodo Payments 单价配置无效")
	}

	originalAmount := amount
	dAmount := decimal.NewFromInt(amount)
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount = dAmount.Div(decimal.NewFromFloat(common.QuotaPerUnit))
	}
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	discount := 1.0
	if value, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(originalAmount)]; ok && value > 0 {
		discount = value
	}

	cents := dAmount.
		Mul(decimal.NewFromFloat(setting.DodoUnitPrice)).
		Mul(decimal.NewFromFloat(topupGroupRatio)).
		Mul(decimal.NewFromFloat(discount)).
		Mul(decimal.NewFromInt(100)).
		Round(0)
	if !cents.IsPositive() || cents.GreaterThan(decimal.NewFromInt(math.MaxInt32)) {
		return 0, 0, errors.New("Dodo Payments 支付金额超出允许范围")
	}
	expectedAmount = cents.IntPart()
	payMoney = decimal.NewFromInt(expectedAmount).Div(decimal.NewFromInt(100)).InexactFloat64()
	return expectedAmount, payMoney, nil
}

func getDodoCreditedQuota(amount int64, group string) decimal.Decimal {
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	quota := decimal.NewFromInt(amount)
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		quota = quota.Div(decimal.NewFromFloat(common.QuotaPerUnit))
	}
	return quota.Mul(decimal.NewFromFloat(topupGroupRatio)).Mul(decimal.NewFromFloat(common.QuotaPerUnit))
}

func getDodoMinTopUp() int64 {
	return dodoDisplayAmountLimit(setting.DodoMinTopUp)
}

func getDodoMaxTopUp() int64 {
	return dodoDisplayAmountLimit(10000)
}

func dodoDisplayAmountLimit(units int) int64 {
	limit := decimal.NewFromInt(int64(units))
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		limit = limit.Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	}
	if !limit.IsPositive() || limit.GreaterThan(decimal.NewFromInt(math.MaxInt64)) {
		return math.MaxInt64
	}
	return limit.Floor().IntPart()
}

func newDodoClient(withWebhookSecret bool) (*dodopayments.Client, error) {
	apiKey := strings.TrimSpace(setting.DodoAPIKey)
	if apiKey == "" {
		return nil, errors.New("Dodo Payments API 密钥未配置")
	}
	options := []option.RequestOption{
		option.WithBearerToken(apiKey),
		// Checkout creation has no idempotency key. Avoid SDK retries that could
		// create multiple payable sessions for the same local order.
		option.WithMaxRetries(0),
	}
	switch strings.TrimSpace(setting.DodoEnvironment) {
	case setting.DodoEnvironmentTestMode:
		options = append(options, option.WithEnvironmentTestMode())
	case setting.DodoEnvironmentLiveMode:
		options = append(options, option.WithEnvironmentLiveMode())
	default:
		return nil, errors.New("Dodo Payments 环境配置无效")
	}
	if withWebhookSecret {
		options = append(options, option.WithWebhookKey(strings.TrimSpace(setting.DodoWebhookSecret)))
	}
	return dodopayments.NewClient(options...), nil
}

func createDodoCheckout(ctx context.Context, client *dodopayments.Client, user *model.User, tradeNo string, expectedAmount int64, successURL string, cancelURL string) (string, string, error) {
	if successURL == "" {
		successURL = paymentReturnPath("/usage-logs")
	}
	if cancelURL == "" {
		cancelURL = paymentReturnPath("/wallet")
	}

	result, err := client.CheckoutSessions.New(ctx, dodopayments.CheckoutSessionNewParams{
		CheckoutSessionRequest: dodopayments.CheckoutSessionRequestParam{
			ProductCart: dodopayments.F([]dodopayments.ProductItemReqParam{{
				ProductID: dodopayments.F(strings.TrimSpace(setting.DodoProductID)),
				Quantity:  dodopayments.F(int64(1)),
				Amount:    dodopayments.F(expectedAmount),
			}}),
			Customer: dodopayments.F[dodopayments.CustomerRequestUnionParam](dodopayments.NewCustomerParam{
				Email: dodopayments.F(strings.TrimSpace(user.Email)),
				Name:  dodopayments.F(user.Username),
			}),
			Metadata: dodopayments.F(dodopayments.MetadataParam{
				"order_type":      shared.UnionString("topup"),
				"trade_no":        shared.UnionString(tradeNo),
				"user_id":         shared.UnionString(strconv.Itoa(user.Id)),
				"product_id":      shared.UnionString(strings.TrimSpace(setting.DodoProductID)),
				"expected_amount": shared.UnionString(strconv.FormatInt(expectedAmount, 10)),
			}),
			BillingCurrency: dodopayments.F(dodopayments.CurrencyUsd),
			ReturnURL:       dodopayments.F(successURL),
			CancelURL:       dodopayments.F(cancelURL),
		},
	})
	if err != nil {
		return "", "", err
	}
	if result == nil || strings.TrimSpace(result.CheckoutURL) == "" {
		return "", "", errors.New("Dodo Payments 未返回 Checkout URL")
	}
	return result.CheckoutURL, result.SessionID, nil
}

func validateDodoProduct(product *dodopayments.Product, expectedProductID string, expectedAmount int64) error {
	if product == nil || product.ProductID != expectedProductID {
		return errors.New("Dodo Payments 商品 ID 不匹配")
	}
	if product.IsRecurring || product.Price.Type != dodopayments.PriceTypeOneTimePrice {
		return errors.New("Dodo Payments 商品必须是单次支付商品")
	}
	if product.Price.Currency != dodopayments.CurrencyUsd {
		return errors.New("Dodo Payments 商品币种必须是 USD")
	}
	if !product.Price.PayWhatYouWant {
		return errors.New("Dodo Payments 商品必须开启自定义金额")
	}
	if expectedAmount < product.Price.Price {
		return fmt.Errorf("支付金额不能低于 Dodo Payments 商品最低金额 %.2f USD", float64(product.Price.Price)/100)
	}
	return nil
}

func handleDodoPaymentSucceeded(ctx context.Context, event dodopayments.PaymentSucceededWebhookEvent, callerIP string) error {
	payment := event.Data
	tradeNo, err := validateDodoPaymentSucceededEnvelope(event.BusinessID, payment)
	if err != nil {
		return err
	}

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		return model.ErrTopUpNotFound
	}
	if err := validateDodoPaymentAgainstTopUp(payment, topUp); err != nil {
		return err
	}

	alreadyDone, err := model.RechargeDodo(tradeNo, payment.PaymentID, callerIP)
	if err != nil {
		return err
	}
	if alreadyDone {
		logger.LogInfo(ctx, fmt.Sprintf("Dodo 重复成功事件已幂等处理 trade_no=%s payment_id=%s", tradeNo, payment.PaymentID))
	}
	return nil
}

func validateDodoPaymentSucceededEnvelope(businessID string, payment dodopayments.Payment) (string, error) {
	if businessID == "" || businessID != payment.BusinessID {
		return "", errors.New("business_id 不匹配")
	}
	if payment.Status != dodopayments.IntentStatusSucceeded {
		return "", fmt.Errorf("支付状态不是 succeeded: %s", payment.Status)
	}
	if payment.Currency != dodopayments.CurrencyUsd {
		return "", fmt.Errorf("支付币种不是 %s: %s", dodoCurrency, payment.Currency)
	}
	if payment.PaymentID == "" {
		return "", errors.New("缺少 payment_id")
	}

	tradeNo, ok := dodoMetadataString(payment.Metadata, "trade_no")
	if !ok || tradeNo == "" {
		return "", errors.New("缺少 trade_no 元数据")
	}
	orderType, ok := dodoMetadataString(payment.Metadata, "order_type")
	if !ok || orderType != "topup" {
		return "", errors.New("order_type 元数据无效")
	}
	productID, ok := dodoMetadataString(payment.Metadata, "product_id")
	if !ok || productID == "" || len(payment.ProductCart) != 1 || payment.ProductCart[0].ProductID != productID || payment.ProductCart[0].Quantity != 1 {
		return "", errors.New("商品信息不匹配")
	}
	return tradeNo, nil
}

func validateDodoPaymentAgainstTopUp(payment dodopayments.Payment, topUp *model.TopUp) error {
	if topUp.PaymentProvider != model.PaymentProviderDodo {
		return model.ErrPaymentMethodMismatch
	}
	userIDText, ok := dodoMetadataString(payment.Metadata, "user_id")
	if !ok || userIDText != strconv.Itoa(topUp.UserId) {
		return errors.New("用户元数据不匹配")
	}
	expectedAmountText, ok := dodoMetadataString(payment.Metadata, "expected_amount")
	if !ok || expectedAmountText != strconv.FormatInt(topUp.ExpectedAmount, 10) {
		return errors.New("订单金额元数据不匹配")
	}
	if topUp.ExpectedAmount <= 0 || payment.Tax < 0 || payment.TotalAmount < payment.Tax {
		return fmt.Errorf("支付金额无效: expected=%d total=%d tax=%d", topUp.ExpectedAmount, payment.TotalAmount, payment.Tax)
	}
	taxInclusiveAmountMatches := payment.TotalAmount == topUp.ExpectedAmount
	taxExclusiveAmountMatches := payment.TotalAmount-payment.Tax == topUp.ExpectedAmount
	if !taxInclusiveAmountMatches && !taxExclusiveAmountMatches {
		return fmt.Errorf("支付金额不匹配: expected=%d total=%d tax=%d", topUp.ExpectedAmount, payment.TotalAmount, payment.Tax)
	}
	return nil
}

func handleDodoPaymentNotSucceeded(ctx context.Context, businessID string, payment dodopayments.Payment, expectedPaymentStatus dodopayments.IntentStatus, targetStatus string, callerIP string) error {
	if businessID == "" || businessID != payment.BusinessID {
		return errors.New("business_id 不匹配")
	}
	if payment.Status != expectedPaymentStatus {
		return fmt.Errorf("支付状态不匹配: expected=%s actual=%s", expectedPaymentStatus, payment.Status)
	}
	tradeNo, ok := dodoMetadataString(payment.Metadata, "trade_no")
	if !ok || tradeNo == "" {
		return errors.New("缺少 trade_no 元数据")
	}
	orderType, ok := dodoMetadataString(payment.Metadata, "order_type")
	if !ok || orderType != "topup" {
		return errors.New("order_type 元数据无效")
	}

	err := model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderDodo, targetStatus)
	if errors.Is(err, model.ErrTopUpStatusInvalid) {
		logger.LogInfo(ctx, fmt.Sprintf("Dodo 未成功事件对应订单已完成或已关闭 trade_no=%s payment_id=%s client_ip=%s", tradeNo, payment.PaymentID, callerIP))
		return nil
	}
	if err != nil {
		return err
	}
	logger.LogInfo(ctx, fmt.Sprintf("Dodo 充值订单已关闭 trade_no=%s payment_id=%s status=%s client_ip=%s", tradeNo, payment.PaymentID, targetStatus, callerIP))
	return nil
}

func dodoMetadataString(metadata dodopayments.Metadata, key string) (string, bool) {
	value, ok := metadata[key]
	if !ok {
		return "", false
	}
	text, ok := value.(shared.UnionString)
	return string(text), ok
}
