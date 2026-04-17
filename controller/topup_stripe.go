package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
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
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/checkout/session"
	"github.com/stripe/stripe-go/v81/webhook"
	"github.com/thanhpk/randstr"
)

const (
	PaymentMethodStripe = "stripe"
)

var stripeAdaptor = &StripeAdaptor{}

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
	if req.Amount < getStripeMinTopup() {
		c.JSON(200, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getStripeMinTopup())})
		return
	}
	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getStripePayMoney(float64(req.Amount), group)
	if payMoney <= 0.01 {
		c.JSON(200, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}
	c.JSON(200, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func (*StripeAdaptor) RequestPay(c *gin.Context, req *StripePayRequest) {
	if req.PaymentMethod != PaymentMethodStripe {
		c.JSON(200, gin.H{"message": "error", "data": "不支持的支付渠道"})
		return
	}
	if req.Amount < getStripeMinTopup() {
		c.JSON(200, gin.H{"message": fmt.Sprintf("充值数量不能小于 %d", getStripeMinTopup()), "data": 10})
		return
	}
	if req.Amount > 10000 {
		c.JSON(200, gin.H{"message": "充值数量不能大于 10000", "data": 10})
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
	chargedMoney := GetChargedAmount(float64(req.Amount), *user)

	reference := fmt.Sprintf("new-api-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	referenceId := "ref_" + common.Sha1([]byte(reference))

	payLink, err := genStripeLink(referenceId, user.StripeCustomer, user.Email, req.Amount, req.SuccessURL, req.CancelURL)
	if err != nil {
		log.Println("获取Stripe Checkout支付链接失败", err)
		c.JSON(200, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	topUp := &model.TopUp{
		UserId:        id,
		Amount:        req.Amount,
		Money:         chargedMoney,
		TradeNo:       referenceId,
		PaymentMethod: PaymentMethodStripe,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	err = topUp.Insert()
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	c.JSON(200, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": payLink,
		},
	})
}

func RequestStripeAmount(c *gin.Context) {
	var req StripePayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	stripeAdaptor.RequestAmount(c, &req)
}

func RequestStripePay(c *gin.Context) {
	var req StripePayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	stripeAdaptor.RequestPay(c, &req)
}

func StripeWebhook(c *gin.Context) {
	if setting.StripeWebhookSecret == "" {
		log.Println("Stripe Webhook Secret 未配置，拒绝处理")
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Printf("解析Stripe Webhook参数失败: %v\n", err)
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}

	signature := c.GetHeader("Stripe-Signature")
	event, err := webhook.ConstructEventWithOptions(payload, signature, setting.StripeWebhookSecret, webhook.ConstructEventOptions{
		IgnoreAPIVersionMismatch: true,
	})

	if err != nil {
		log.Printf("Stripe Webhook验签失败: %v\n", err)
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	ctx := c.Request.Context()

	var handlerErr error
	switch event.Type {
	case stripe.EventTypeCheckoutSessionCompleted:
		handlerErr = sessionCompleted(ctx, event)
	case stripe.EventTypeCheckoutSessionExpired:
		handlerErr = sessionExpired(ctx, event)
	case stripe.EventTypeCheckoutSessionAsyncPaymentSucceeded:
		handlerErr = sessionAsyncPaymentSucceeded(ctx, event)
	case stripe.EventTypeCheckoutSessionAsyncPaymentFailed:
		handlerErr = sessionAsyncPaymentFailed(ctx, event)
	default:
		log.Printf("不支持的Stripe Webhook事件类型: %s\n", event.Type)
	}

	if handlerErr != nil {
		log.Printf("Stripe Webhook处理失败，将返回5xx以触发重试: %v", handlerErr)
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	c.Status(http.StatusOK)
}

// retrieveAndVerifyCheckoutSession calls the Stripe API to retrieve the authoritative
// checkout session state, rather than trusting the webhook event payload alone.
func retrieveAndVerifyCheckoutSession(ctx context.Context, sessionId string) (*stripe.CheckoutSession, error) {
	if sessionId == "" {
		return nil, fmt.Errorf("empty checkout session ID")
	}
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return nil, fmt.Errorf("invalid Stripe API key configured")
	}
	stripe.Key = setting.StripeApiSecret

	apiCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	sess, err := session.Get(sessionId, &stripe.CheckoutSessionParams{
		Params: stripe.Params{Context: apiCtx},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve checkout session %s from Stripe API: %w", sessionId, err)
	}
	return sess, nil
}

func sessionCompleted(ctx context.Context, event stripe.Event) error {
	sessionId := event.GetObjectValue("id")
	sess, err := retrieveAndVerifyCheckoutSession(ctx, sessionId)
	if err != nil {
		return fmt.Errorf("Stripe Checkout Session API验证失败: %w", err)
	}

	if sess.Status != stripe.CheckoutSessionStatusComplete {
		log.Printf("Stripe API返回非完成状态: %s, session: %s", sess.Status, sessionId)
		return nil
	}

	if sess.PaymentStatus != stripe.CheckoutSessionPaymentStatusPaid {
		log.Printf("Stripe Checkout 支付尚未完成，payment_status: %s, session: %s（等待异步支付结果）", sess.PaymentStatus, sessionId)
		return nil
	}

	referenceId := sess.ClientReferenceID
	customerId := ""
	if sess.Customer != nil {
		customerId = sess.Customer.ID
	}

	fulfillOrder(sess, event.Type, referenceId, customerId)
	return nil
}

// sessionAsyncPaymentSucceeded handles delayed payment methods (bank transfer, SEPA, etc.)
// that confirm payment after the checkout session completes.
func sessionAsyncPaymentSucceeded(ctx context.Context, event stripe.Event) error {
	sessionId := event.GetObjectValue("id")
	sess, err := retrieveAndVerifyCheckoutSession(ctx, sessionId)
	if err != nil {
		return fmt.Errorf("Stripe 异步支付成功事件API验证失败: %w", err)
	}

	if sess.PaymentStatus != stripe.CheckoutSessionPaymentStatusPaid {
		log.Printf("Stripe API返回异步支付未完成，payment_status: %s, session: %s", sess.PaymentStatus, sessionId)
		return nil
	}

	referenceId := sess.ClientReferenceID
	customerId := ""
	if sess.Customer != nil {
		customerId = sess.Customer.ID
	}
	log.Printf("Stripe 异步支付成功(API验证): %s", referenceId)

	fulfillOrder(sess, event.Type, referenceId, customerId)
	return nil
}

// sessionAsyncPaymentFailed marks orders as failed when delayed payment methods
// ultimately fail (e.g. bank transfer not received, SEPA rejected).
func sessionAsyncPaymentFailed(ctx context.Context, event stripe.Event) error {
	sessionId := event.GetObjectValue("id")
	sess, err := retrieveAndVerifyCheckoutSession(ctx, sessionId)
	if err != nil {
		return fmt.Errorf("Stripe 异步支付失败事件API验证失败: %w", err)
	}

	referenceId := sess.ClientReferenceID
	if len(referenceId) == 0 {
		log.Println("异步支付失败事件未提供支付单号")
		return nil
	}

	log.Printf("Stripe 异步支付失败(API验证): %s", referenceId)

	if sess.PaymentStatus == stripe.CheckoutSessionPaymentStatusPaid {
		log.Printf("Stripe API显示支付已成功，拒绝标记订单为失败: %s", referenceId)
		return nil
	}

	LockOrder(referenceId)
	defer UnlockOrder(referenceId)

	topUp := model.GetTopUpByTradeNo(referenceId)
	if topUp == nil {
		log.Println("异步支付失败，充值订单不存在:", referenceId)
		return nil
	}

	if topUp.PaymentMethod != PaymentMethodStripe {
		log.Printf("异步支付失败，订单支付方式不匹配: %s, ref: %s", topUp.PaymentMethod, referenceId)
		return nil
	}

	if topUp.Status != common.TopUpStatusPending {
		log.Printf("异步支付失败，订单状态非pending: %s, ref: %s", topUp.Status, referenceId)
		return nil
	}

	topUp.Status = common.TopUpStatusFailed
	if err := topUp.Update(); err != nil {
		return fmt.Errorf("标记充值订单失败出错, ref: %s: %w", referenceId, err)
	}
	log.Printf("充值订单已标记为失败: %s", referenceId)
	return nil
}

// fulfillOrder is the shared logic for crediting quota after payment is confirmed via Stripe API.
func fulfillOrder(sess *stripe.CheckoutSession, eventType stripe.EventType, referenceId string, customerId string) {
	if len(referenceId) == 0 {
		log.Println("未提供支付单号")
		return
	}

	if sess.AmountTotal <= 0 {
		log.Printf("Stripe API返回无效支付金额: %d, ref: %s", sess.AmountTotal, referenceId)
		return
	}

	LockOrder(referenceId)
	defer UnlockOrder(referenceId)
	payload := map[string]any{
		"customer":     customerId,
		"amount_total": sess.AmountTotal,
		"currency":     strings.ToUpper(string(sess.Currency)),
		"event_type":   string(eventType),
	}
	if err := model.CompleteSubscriptionOrder(referenceId, common.GetJsonString(payload)); err == nil {
		return
	} else if !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		log.Println("complete subscription order failed:", err.Error(), referenceId)
		return
	}

	err := model.Recharge(referenceId, customerId)
	if err != nil {
		log.Println(err.Error(), referenceId)
		return
	}

	currency := strings.ToUpper(string(sess.Currency))
	log.Printf("收到款项(API验证)：%s, %.2f(%s)", referenceId, float64(sess.AmountTotal)/100, currency)
}

func sessionExpired(ctx context.Context, event stripe.Event) error {
	sessionId := event.GetObjectValue("id")
	sess, err := retrieveAndVerifyCheckoutSession(ctx, sessionId)
	if err != nil {
		return fmt.Errorf("Stripe Checkout过期事件API验证失败: %w", err)
	}

	if sess.Status != stripe.CheckoutSessionStatusExpired {
		log.Printf("Stripe API返回非过期状态: %s, session: %s", sess.Status, sessionId)
		return nil
	}

	referenceId := sess.ClientReferenceID
	if len(referenceId) == 0 {
		log.Println("未提供支付单号")
		return nil
	}

	// Subscription order expiration
	LockOrder(referenceId)
	defer UnlockOrder(referenceId)
	if err := model.ExpireSubscriptionOrder(referenceId); err == nil {
		return nil
	} else if !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		log.Println("过期订阅订单失败", referenceId, ", err:", err.Error())
		return nil
	}

	topUp := model.GetTopUpByTradeNo(referenceId)
	if topUp == nil {
		log.Println("充值订单不存在", referenceId)
		return nil
	}

	if topUp.Status != common.TopUpStatusPending {
		log.Println("充值订单状态错误", referenceId)
	}

	topUp.Status = common.TopUpStatusExpired
	err = topUp.Update()
	if err != nil {
		return fmt.Errorf("过期充值订单失败, ref: %s: %w", referenceId, err)
	}

	log.Println("充值订单已过期", referenceId)
	return nil
}

// genStripeLink generates a Stripe Checkout session URL for payment.
// It creates a new checkout session with the specified parameters and returns the payment URL.
//
// Parameters:
//   - referenceId: unique reference identifier for the transaction
//   - customerId: existing Stripe customer ID (empty string if new customer)
//   - email: customer email address for new customer creation
//   - amount: quantity of units to purchase
//   - successURL: custom URL to redirect after successful payment (empty for default)
//   - cancelURL: custom URL to redirect when payment is canceled (empty for default)
//
// Returns the checkout session URL or an error if the session creation fails.
func genStripeLink(referenceId string, customerId string, email string, amount int64, successURL string, cancelURL string) (string, error) {
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return "", fmt.Errorf("无效的Stripe API密钥")
	}

	stripe.Key = setting.StripeApiSecret

	// Use custom URLs if provided, otherwise use defaults
	if successURL == "" {
		successURL = system_setting.ServerAddress + "/console/log"
	}
	if cancelURL == "" {
		cancelURL = system_setting.ServerAddress + "/console/topup"
	}

	params := &stripe.CheckoutSessionParams{
		ClientReferenceID: stripe.String(referenceId),
		SuccessURL:        stripe.String(successURL),
		CancelURL:         stripe.String(cancelURL),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(setting.StripePriceId),
				Quantity: stripe.Int64(amount),
			},
		},
		Mode:                stripe.String(string(stripe.CheckoutSessionModePayment)),
		AllowPromotionCodes: stripe.Bool(setting.StripePromotionCodesEnabled),
	}

	if "" == customerId {
		if "" != email {
			params.CustomerEmail = stripe.String(email)
		}

		params.CustomerCreation = stripe.String(string(stripe.CheckoutSessionCustomerCreationAlways))
	} else {
		params.Customer = stripe.String(customerId)
	}

	result, err := session.New(params)
	if err != nil {
		return "", err
	}

	return result.URL, nil
}

func GetChargedAmount(count float64, user model.User) float64 {
	topUpGroupRatio := common.GetTopupGroupRatio(user.Group)
	if topUpGroupRatio == 0 {
		topUpGroupRatio = 1
	}

	return count * topUpGroupRatio
}

func getStripePayMoney(amount float64, group string) float64 {
	originalAmount := amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = amount / common.QuotaPerUnit
	}
	// Using float64 for monetary calculations is acceptable here due to the small amounts involved
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	// apply optional preset discount by the original request amount (if configured), default 1.0
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(originalAmount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}
	payMoney := amount * setting.StripeUnitPrice * topupGroupRatio * discount
	return payMoney
}

func getStripeMinTopup() int64 {
	minTopup := setting.StripeMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		minTopup = minTopup * int(common.QuotaPerUnit)
	}
	return int64(minTopup)
}
