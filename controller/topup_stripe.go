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

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/checkout/session"
	"github.com/stripe/stripe-go/v81/webhook"
	"github.com/thanhpk/randstr"
)

var stripeAdaptor = &StripeAdaptor{}

const (
	stripeWalletCurrency           = "USD"
	stripeWalletCurrencyScale      = int64(100)
	stripeWalletProductName        = "New API wallet top up"
	stripeWalletBindingMetadataKey = "new_api_wallet_binding"
	stripeWalletBindingTokenLength = 32
	stripeWalletMaxTopup           = int64(10000)
)

var createStripeCheckoutSession = session.New

type stripeWalletQuote struct {
	Amount     decimal.Decimal
	AmountUnit int64
	Currency   string
}

// StripePayRequest represents a payment request for Stripe checkout.
type StripePayRequest struct {
	// Amount is the quantity of units to purchase.
	Amount int64 `json:"amount"`
	// PaymentMethod specifies the payment method (e.g., "stripe").
	PaymentMethod string `json:"payment_method"`
	// SuccessURL is the optional custom URL to redirect after successful payment.
	// If empty, defaults to the server's console log page.
	SuccessURL string `json:"success_url,omitempty"`
	// CancelURL is the optional custom URL to redirect when payment is canceled.
	// If empty, defaults to the server's console topup page.
	CancelURL string `json:"cancel_url,omitempty"`
}

type StripeAdaptor struct {
}

func (*StripeAdaptor) RequestAmount(c *gin.Context, req *StripePayRequest) {
	minTopup, maxTopup, err := getStripeTopupBounds()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Stripe 充值配置无效"})
		return
	}
	if req.Amount < minTopup {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", minTopup)})
		return
	}
	if req.Amount > maxTopup {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能大于 %d", maxTopup)})
		return
	}
	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	if rejectInvalidCreditedQuota(c, id, getStripeCreditedQuota(req.Amount, group)) {
		return
	}

	quote := getStripeWalletQuote(req.Amount, group)
	if quote.Amount.LessThanOrEqual(decimal.NewFromFloat(0.01)) {

		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message":  "success",
		"data":     quote.Amount.StringFixed(2),
		"currency": quote.Currency,
	})
}

func (*StripeAdaptor) RequestPay(c *gin.Context, req *StripePayRequest) {
	if req.PaymentMethod != model.PaymentMethodStripe {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的支付渠道"})
		return
	}
	minTopup, maxTopup, err := getStripeTopupBounds()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Stripe 充值配置无效"})
		return
	}
	if req.Amount < minTopup {
		c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("充值数量不能小于 %d", minTopup), "data": 10})
		return
	}
	if req.Amount > maxTopup {
		c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("充值数量不能大于 %d", maxTopup), "data": 10})
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
	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {

		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 获取充值用户失败 user_id=%d error=%q", id, func() string {
			if err == nil {
				return "user not found"
			}
			return err.Error()
		}()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户信息失败"})
		return
	}

	creditedQuota, err := validateCreditedQuota(getStripeCreditedQuota(req.Amount, user.Group))
	if err == nil {
		err = model.ValidateTopUpQuotaCapacity(id, creditedQuota)
	}
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": err.Error()})
		return
	}

	quote := getStripeWalletQuote(req.Amount, user.Group)
	if quote.Amount.LessThanOrEqual(decimal.NewFromFloat(0.01)) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})

		return
	}

	reference := fmt.Sprintf("new-api-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	referenceId := "ref_" + common.Sha1([]byte(reference))
	bindingToken, err := common.GenerateRandomCharsKey(stripeWalletBindingTokenLength)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 生成充值订单绑定令牌失败 user_id=%d trade_no=%s error=%q", id, referenceId, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	topUp := &model.TopUp{
		UserId:                    id,
		Amount:                    req.Amount,
		Money:                     quote.Amount.InexactFloat64(),
		TradeNo:                   referenceId,
		PaymentMethod:             model.PaymentMethodStripe,
		PaymentProvider:           model.PaymentProviderStripe,
		PaymentExpectationVersion: model.StripePaymentExpectationVersion,
		ExpectedAmount:            quote.Amount.InexactFloat64(),
		ExpectedAmountUnit:        quote.AmountUnit,
		ExpectedCreditedQuota:     int64(creditedQuota),
		ExpectedCurrency:          quote.Currency,
		ExpectedBindingToken:      bindingToken,
		CreateTime:                time.Now().Unix(),
		Status:                    common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, referenceId, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	checkoutSession, err := genStripeCheckoutSession(referenceId, bindingToken, user.StripeCustomer, user.Email, quote, req.SuccessURL, req.CancelURL)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 创建 Checkout Session 失败 user_id=%d trade_no=%s amount=%d error=%q", id, referenceId, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}
	if checkoutSession == nil || checkoutSession.ID == "" || checkoutSession.URL == "" {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe Checkout Session 返回无效 user_id=%d trade_no=%s", id, referenceId))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}
	if err := model.SetStripeTopUpExpectedSessionID(referenceId, checkoutSession.ID); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 持久化 Checkout Session 失败 user_id=%d trade_no=%s session_id=%s error=%q", id, referenceId, checkoutSession.ID, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Stripe 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%s currency=%s session_id=%s", id, referenceId, req.Amount, quote.Amount.StringFixed(2), quote.Currency, checkoutSession.ID))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": checkoutSession.URL,
		},
	})
}

func RequestStripeAmount(c *gin.Context) {
	var req StripePayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	stripeAdaptor.RequestAmount(c, &req)
}

func RequestStripePay(c *gin.Context) {
	var req StripePayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	stripeAdaptor.RequestPay(c, &req)
}

func StripeWebhook(c *gin.Context) {
	ctx := c.Request.Context()
	if !isStripeWebhookEnabled() {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe webhook 读取请求体失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}

	signature := c.GetHeader("Stripe-Signature")
	logger.LogInfo(ctx, fmt.Sprintf("Stripe webhook 收到请求 path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
	event, err := webhook.ConstructEventWithOptions(payload, signature, setting.StripeWebhookSecret, webhook.ConstructEventOptions{
		IgnoreAPIVersionMismatch: true,
	})

	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe webhook 验签失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	callerIp := c.ClientIP()
	logger.LogInfo(ctx, fmt.Sprintf("Stripe webhook 验签成功 event_type=%s client_ip=%s path=%q", string(event.Type), callerIp, c.Request.RequestURI))
	var handlingErr error
	switch event.Type {
	case stripe.EventTypeCheckoutSessionCompleted:
		handlingErr = sessionCompleted(ctx, event, callerIp)
	case stripe.EventTypeCheckoutSessionExpired:
		handlingErr = sessionExpired(ctx, event)
	case stripe.EventTypeCheckoutSessionAsyncPaymentSucceeded:
		handlingErr = sessionAsyncPaymentSucceeded(ctx, event, callerIp)
	case stripe.EventTypeCheckoutSessionAsyncPaymentFailed:
		handlingErr = sessionAsyncPaymentFailed(ctx, event, callerIp)
	default:
		logger.LogInfo(ctx, fmt.Sprintf("Stripe webhook 忽略事件 event_type=%s client_ip=%s", string(event.Type), callerIp))
	}
	if handlingErr != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe webhook 处理失败 event_type=%s client_ip=%s retryable=%t error=%q", string(event.Type), callerIp, isRetryableStripeWebhookError(handlingErr), handlingErr.Error()))
		if isRetryableStripeWebhookError(handlingErr) {
			c.AbortWithStatus(http.StatusServiceUnavailable)
			return
		}
	}

	c.Status(http.StatusOK)
}

func isRetryableStripeWebhookError(err error) bool {
	return errors.Is(err, model.ErrStripeSessionBindingPending) ||
		errors.Is(err, model.ErrTopUpNotFound) ||
		errors.Is(err, model.ErrSubscriptionOrderNotFound) ||
		!errors.Is(err, model.ErrLegacyPaymentExpectation) &&
			!errors.Is(err, model.ErrPaymentExpectationInvalid) &&
			!errors.Is(err, model.ErrPaymentSettlementMismatch) &&
			!errors.Is(err, model.ErrPaymentMethodMismatch) &&
			!errors.Is(err, model.ErrTopUpStatusInvalid) &&
			!errors.Is(err, model.ErrSubscriptionOrderStatusInvalid) &&
			!errors.Is(err, model.ErrSubscriptionEntitlementInvalid)
}

func sessionCompleted(ctx context.Context, event stripe.Event, callerIp string) error {
	customerId := event.GetObjectValue("customer")
	referenceId := event.GetObjectValue("client_reference_id")
	status := event.GetObjectValue("status")
	if "complete" != status {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe checkout.completed 状态异常，忽略处理 trade_no=%s status=%s client_ip=%s", referenceId, status, callerIp))
		return nil
	}

	paymentStatus := event.GetObjectValue("payment_status")
	if paymentStatus != "paid" {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe Checkout 支付未完成，等待异步结果 trade_no=%s payment_status=%s client_ip=%s", referenceId, paymentStatus, callerIp))
		return nil
	}

	return fulfillOrder(ctx, event, referenceId, customerId, callerIp)
}

// sessionAsyncPaymentSucceeded handles delayed payment methods (bank transfer, SEPA, etc.)
// that confirm payment after the checkout session completes.
func sessionAsyncPaymentSucceeded(ctx context.Context, event stripe.Event, callerIp string) error {
	customerId := event.GetObjectValue("customer")
	referenceId := event.GetObjectValue("client_reference_id")
	logger.LogInfo(ctx, fmt.Sprintf("Stripe 异步支付成功 trade_no=%s client_ip=%s", referenceId, callerIp))

	return fulfillOrder(ctx, event, referenceId, customerId, callerIp)
}

// sessionAsyncPaymentFailed marks orders as failed when delayed payment methods
// ultimately fail (e.g. bank transfer not received, SEPA rejected).
func sessionAsyncPaymentFailed(ctx context.Context, event stripe.Event, callerIp string) error {
	referenceId := event.GetObjectValue("client_reference_id")
	logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败 trade_no=%s client_ip=%s", referenceId, callerIp))

	if len(referenceId) == 0 {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败事件缺少订单号 client_ip=%s", callerIp))
		return model.ErrPaymentExpectationInvalid
	}

	LockOrder(referenceId)
	defer UnlockOrder(referenceId)

	topUp := model.GetTopUpByTradeNo(referenceId)
	if topUp == nil {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败但本地订单不存在 trade_no=%s client_ip=%s", referenceId, callerIp))
		return model.ErrTopUpNotFound
	}

	if topUp.PaymentProvider != model.PaymentProviderStripe {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败但订单支付网关不匹配 trade_no=%s payment_provider=%s client_ip=%s", referenceId, topUp.PaymentProvider, callerIp))
		return model.ErrPaymentMethodMismatch
	}

	if topUp.Status != common.TopUpStatusPending {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 异步支付失败但订单状态非 pending，忽略处理 trade_no=%s status=%s client_ip=%s", referenceId, topUp.Status, callerIp))
		return nil
	}

	topUp.Status = common.TopUpStatusFailed
	if err := topUp.Update(); err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe 标记充值订单失败状态失败 trade_no=%s client_ip=%s error=%q", referenceId, callerIp, err.Error()))
		return err
	}
	logger.LogInfo(ctx, fmt.Sprintf("Stripe 充值订单已标记为失败 trade_no=%s client_ip=%s", referenceId, callerIp))
	return nil
}

// fulfillOrder is the shared logic for crediting quota after payment is confirmed.
func fulfillOrder(ctx context.Context, event stripe.Event, referenceId string, customerId string, callerIp string) error {
	if len(referenceId) == 0 {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 完成订单时缺少订单号 client_ip=%s", callerIp))
		return model.ErrPaymentExpectationInvalid
	}

	LockOrder(referenceId)
	defer UnlockOrder(referenceId)
	payload := map[string]any{
		"customer":     customerId,
		"amount_total": event.GetObjectValue("amount_total"),
		"currency":     strings.ToUpper(event.GetObjectValue("currency")),
		"event_type":   string(event.Type),
	}
	if err := model.CompleteSubscriptionOrder(referenceId, common.GetJsonString(payload), model.PaymentProviderStripe, ""); err == nil {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 订阅订单处理成功 trade_no=%s event_type=%s client_ip=%s", referenceId, string(event.Type), callerIp))
		return nil
	} else if !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		logger.LogError(ctx, fmt.Sprintf("Stripe 订阅订单处理失败 trade_no=%s event_type=%s client_ip=%s error=%q", referenceId, string(event.Type), callerIp, err.Error()))
		return err
	}

	amountUnit, err := strconv.ParseInt(event.GetObjectValue("amount_total"), 10, 64)
	if err != nil || amountUnit <= 0 {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 充值事件金额无效 trade_no=%s amount_total=%q event_type=%s client_ip=%s", referenceId, event.GetObjectValue("amount_total"), string(event.Type), callerIp))
		return model.ErrPaymentExpectationInvalid
	}
	settlement := model.StripeSettlement{
		SessionID:    event.GetObjectValue("id"),
		BindingToken: event.GetObjectValue("metadata", stripeWalletBindingMetadataKey),
		AmountUnit:   amountUnit,
		Currency:     strings.ToUpper(event.GetObjectValue("currency")),
		CustomerID:   customerId,
		CallerIP:     callerIp,
	}
	if err := model.RechargeStripeSettlement(referenceId, settlement); err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe 充值处理失败 trade_no=%s event_type=%s client_ip=%s error=%q", referenceId, string(event.Type), callerIp, err.Error()))
		return err
	}

	logger.LogInfo(ctx, fmt.Sprintf("Stripe 充值成功 trade_no=%s amount_total=%.2f currency=%s event_type=%s client_ip=%s", referenceId, float64(amountUnit)/float64(stripeWalletCurrencyScale), settlement.Currency, string(event.Type), callerIp))
	return nil
}

func sessionExpired(ctx context.Context, event stripe.Event) error {
	referenceId := event.GetObjectValue("client_reference_id")
	status := event.GetObjectValue("status")
	if "expired" != status {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe checkout.expired 状态异常，忽略处理 trade_no=%s status=%s", referenceId, status))
		return nil
	}

	if len(referenceId) == 0 {
		logger.LogWarn(ctx, "Stripe checkout.expired 缺少订单号")
		return model.ErrPaymentExpectationInvalid
	}

	// Subscription order expiration
	LockOrder(referenceId)
	defer UnlockOrder(referenceId)
	if err := model.ExpireSubscriptionOrder(referenceId, model.PaymentProviderStripe); err == nil {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 订阅订单已过期 trade_no=%s", referenceId))
		return nil
	} else if !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		logger.LogError(ctx, fmt.Sprintf("Stripe 订阅订单过期处理失败 trade_no=%s error=%q", referenceId, err.Error()))
		return err
	}

	err := model.UpdatePendingTopUpStatus(referenceId, model.PaymentProviderStripe, common.TopUpStatusExpired)
	if errors.Is(err, model.ErrTopUpNotFound) {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 充值订单不存在，无法标记过期 trade_no=%s", referenceId))
		return err
	}
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe 充值订单过期处理失败 trade_no=%s error=%q", referenceId, err.Error()))
		return err
	}

	logger.LogInfo(ctx, fmt.Sprintf("Stripe 充值订单已过期 trade_no=%s", referenceId))
	return nil
}

// genStripeCheckoutSession creates a Checkout Session whose provider amount is
// the already-normalized wallet quote. The inline product intentionally keeps a
// configured Stripe Price ID out of the wallet amount authority.
func genStripeCheckoutSession(referenceID string, bindingToken string, customerID string, email string, quote stripeWalletQuote, successURL string, cancelURL string) (*stripe.CheckoutSession, error) {
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return nil, fmt.Errorf("无效的Stripe API密钥")
	}
	if bindingToken == "" {
		return nil, fmt.Errorf("无效的 Stripe 订单绑定令牌")
	}
	if quote.AmountUnit <= 0 || quote.Currency != stripeWalletCurrency {
		return nil, fmt.Errorf("无效的 Stripe 充值报价")
	}

	stripe.Key = setting.StripeApiSecret

	if successURL == "" {
		successURL = paymentReturnPath("/usage-logs")
	}
	if cancelURL == "" {
		cancelURL = paymentReturnPath("/wallet")
	}

	params := &stripe.CheckoutSessionParams{
		ClientReferenceID: stripe.String(referenceID),
		SuccessURL:        stripe.String(successURL),
		CancelURL:         stripe.String(cancelURL),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency:   stripe.String(strings.ToLower(quote.Currency)),
					UnitAmount: stripe.Int64(quote.AmountUnit),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name: stripe.String(stripeWalletProductName),
					},
				},
				Quantity: stripe.Int64(1),
			},
		},
		Mode:                stripe.String(string(stripe.CheckoutSessionModePayment)),
		AllowPromotionCodes: stripe.Bool(false),
	}
	params.SetIdempotencyKey(referenceID)
	params.AddMetadata(stripeWalletBindingMetadataKey, bindingToken)

	if customerID == "" {
		if email != "" {
			params.CustomerEmail = stripe.String(email)
		}
		params.CustomerCreation = stripe.String(string(stripe.CheckoutSessionCustomerCreationAlways))
	} else {
		params.Customer = stripe.String(customerID)
	}

	return createStripeCheckoutSession(params)
}

func getStripeCreditedQuota(amount int64, group string) decimal.Decimal {
	ratio := common.GetTopupGroupRatio(group)
	if ratio == 0 {
		ratio = 1
	}
	quota := decimal.NewFromInt(amount).Mul(decimal.NewFromFloat(ratio))
	if operation_setting.GetQuotaDisplayType() != operation_setting.QuotaDisplayTypeTokens {
		quota = quota.Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	}
	return quota
}

func getStripeWalletQuote(amount int64, group string) stripeWalletQuote {
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

	normalizedAmount := dAmount.
		Mul(decimal.NewFromFloat(setting.StripeUnitPrice)).
		Mul(decimal.NewFromFloat(topupGroupRatio)).
		Mul(decimal.NewFromFloat(discount)).
		Round(2)

	return stripeWalletQuote{
		Amount:     normalizedAmount,
		AmountUnit: normalizedAmount.Mul(decimal.NewFromInt(stripeWalletCurrencyScale)).IntPart(),
		Currency:   stripeWalletCurrency,
	}
}

func getStripeTopupBounds() (int64, int64, error) {
	minTopup := decimal.NewFromInt(int64(setting.StripeMinTopUp))
	maxTopup := decimal.NewFromInt(stripeWalletMaxTopup)
	if minTopup.LessThanOrEqual(decimal.Zero) {
		return 0, 0, errors.New("Stripe minimum top-up must be positive")
	}

	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		if !hasValidQuotaPerUnit() {
			return 0, 0, errors.New("quota per unit must be finite and positive")
		}
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		minTopup = minTopup.Mul(dQuotaPerUnit).Ceil()
		maxTopup = maxTopup.Mul(dQuotaPerUnit).Floor()
	}

	maxInt64 := decimal.NewFromInt(math.MaxInt64)
	if minTopup.LessThanOrEqual(decimal.Zero) ||
		maxTopup.LessThanOrEqual(decimal.Zero) ||
		minTopup.GreaterThan(maxInt64) ||
		maxTopup.GreaterThan(maxInt64) ||
		minTopup.GreaterThan(maxTopup) {
		return 0, 0, errors.New("Stripe top-up bounds are not representable")
	}

	return minTopup.IntPart(), maxTopup.IntPart(), nil
}

func getStripeMaxTopup() int64 {
	_, maxTopup, err := getStripeTopupBounds()
	if err != nil {
		return 0
	}
	return maxTopup
}

func getStripeMinTopup() int64 {
	minTopup, _, err := getStripeTopupBounds()
	if err != nil {
		return 0
	}
	return minTopup
}
