package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/airwallex"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
)

type SubscriptionAirwallexPayRequest struct {
	PlanId    int    `json:"plan_id"`
	Method    string `json:"method"`     // card / applepay / googlepay / alipay / wechat
	ReturnUrl string `json:"return_url"` // optional; origin must be JINN-trusted, else ignored
}

// airwallexReturnUrl resolves the post-checkout landing URL: a client-supplied
// return_url whose origin is JINN-trusted, else the admin-console fallback.
func airwallexReturnUrl(requested string) string {
	if requested != "" {
		if u, err := url.Parse(requested); err == nil && (u.Scheme == "https" || u.Scheme == "http") {
			if middleware.TrustedBrowserOrigin(u.Scheme + "://" + u.Host) {
				return requested
			}
		}
	}
	return paymentReturnPath("/console/topup")
}

// jinnMethod → the Airwallex payment_method_type names that must be active for it.
var airwallexMethodNames = map[string][]string{
	model.PaymentMethodCard:      {"card"},
	model.PaymentMethodApplePay:  {"applepay"},
	model.PaymentMethodGooglePay: {"googlepay"},
	model.PaymentMethodAlipay:    {"alipaycn", "alipayhk"},
	model.PaymentMethodWeChat:    {"wechatpay"},
}

func airwallexConfigured() string {
	if !setting.AirwallexEnabled {
		return "Airwallex 未启用"
	}
	if setting.AirwallexClientId == "" || setting.AirwallexApiKey == "" {
		return "Airwallex 未配置或密钥无效"
	}
	if setting.AirwallexWebhookSecret == "" {
		return "Airwallex Webhook 未配置"
	}
	return ""
}

func SubscriptionRequestAirwallexPay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	var req SubscriptionAirwallexPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if req.Method == "" {
		req.Method = model.PaymentMethodCard
	}
	requiredNames, ok := airwallexMethodNames[req.Method]
	if !ok {
		common.ApiErrorMsg(c, "不支持的支付方式")
		return
	}

	if msg := airwallexConfigured(); msg != "" {
		common.ApiErrorMsg(c, msg)
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorMsg(c, "套餐未启用")
		return
	}
	if plan.AirwallexPriceId == "" {
		common.ApiErrorMsg(c, "该套餐未配置 AirwallexPriceId")
		return
	}

	// Only offer methods the entity actually has activated (Alipay/WeChat ship
	// dormant here until Airwallex approves them on the account).
	active, err := airwallex.ActivePaymentMethodNames()
	if err != nil {
		logger.LogError(c.Request.Context(), "Airwallex payment_method_types 查询失败: "+err.Error())
		common.ApiErrorMsg(c, "支付服务暂不可用")
		return
	}
	methodActive := false
	for _, name := range requiredNames {
		if active[name] {
			methodActive = true
			break
		}
	}
	if !methodActive {
		common.ApiErrorMsg(c, "该支付方式暂不可用")
		return
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user == nil {
		common.ApiErrorMsg(c, "用户不存在")
		return
	}

	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorMsg(c, "已达到该套餐购买上限")
			return
		}
	}

	reference := fmt.Sprintf("sub-awx-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	referenceId := "sub_ref_" + common.Sha1([]byte(reference))

	payLink, err := genAirwallexSubscriptionLink(c, user, plan, req.Method, referenceId, airwallexReturnUrl(req.ReturnUrl))
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Airwallex 订阅支付链接创建失败 trade_no=%s plan_id=%d error=%q", referenceId, plan.Id, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	order := &model.SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         referenceId,
		PaymentMethod:   req.Method,
		PaymentProvider: model.PaymentProviderAirwallex,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": payLink,
		},
	})
}

// genAirwallexSubscriptionLink returns the hosted-checkout URL for the chosen method.
//   - auto-renew methods (card wallets, later Alipay): HPP recurring mode collects a
//     merchant-triggered PaymentConsent; the webhook then creates the managed Subscription.
//   - wechat: one-time PaymentIntent for a single term (manual renew) — no consent exists.
func genAirwallexSubscriptionLink(c *gin.Context, user *model.User, plan *model.SubscriptionPlan, method string, tradeNo string, returnUrl string) (string, error) {
	merchantCustomerId := strconv.Itoa(user.Id)
	customer, err := airwallex.FindCustomerByMerchantId(merchantCustomerId)
	if err != nil {
		return "", err
	}
	if customer == nil {
		customer, err = airwallex.CreateCustomer(tradeNo+"-cus", merchantCustomerId, user.Email)
		if err != nil {
			return "", err
		}
	}

	if method == model.PaymentMethodWeChat {
		intent, err := airwallex.CreatePaymentIntent(tradeNo, plan.PriceAmount, plan.Currency, tradeNo, customer.Id,
			map[string]string{"trade_no": tradeNo, "kind": "subscription_oneoff"})
		if err != nil {
			return "", err
		}
		return airwallex.StandardCheckoutURL(intent.Id, intent.ClientSecret, plan.Currency, returnUrl, returnUrl), nil
	}

	secret, err := airwallex.GenerateCustomerClientSecret(customer.Id)
	if err != nil {
		return "", err
	}
	return airwallex.RecurringCheckoutURL(secret, customer.Id, plan.Currency, returnUrl, returnUrl), nil
}

// SubscriptionCancelAirwallex stops auto-renew for the caller's active Airwallex
// subscriptions (proration NONE — no refund; the current term runs to its end and
// the engine's ExpireDueSubscriptions performs the downgrade then).
func SubscriptionCancelAirwallex(c *gin.Context) {
	if msg := airwallexConfigured(); msg != "" {
		common.ApiErrorMsg(c, msg)
		return
	}
	userId := c.GetInt("id")
	customer, err := airwallex.FindCustomerByMerchantId(strconv.Itoa(userId))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if customer == nil {
		common.ApiErrorMsg(c, "无进行中的订阅")
		return
	}
	subs, err := airwallex.ListSubscriptions(customer.Id, "ACTIVE")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	cancelled := 0
	for _, sub := range subs {
		reqId := fmt.Sprintf("cancel-%s-%d", sub.Id, time.Now().UnixMilli())
		if err := airwallex.CancelSubscription(sub.Id, reqId, "NONE"); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("Airwallex 取消订阅失败 sub=%s error=%q", sub.Id, err.Error()))
			common.ApiErrorMsg(c, "取消订阅失败，请稍后重试")
			return
		}
		cancelled++
	}
	if cancelled == 0 {
		common.ApiErrorMsg(c, "无进行中的订阅")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"cancelled": cancelled}})
}

// ---- webhook ----

type airwallexEvent struct {
	Id   string `json:"id"`
	Name string `json:"name"`
	Data struct {
		Object map[string]any `json:"object"`
	} `json:"data"`
}

// verifyAirwallexSignature checks x-signature == HMAC-SHA256(x-timestamp + rawBody, webhook secret).
func verifyAirwallexSignature(timestamp, signature string, body []byte) bool {
	if timestamp == "" || signature == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(setting.AirwallexWebhookSecret))
	mac.Write([]byte(timestamp))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(strings.ToLower(signature)))
}

func AirwallexWebhook(c *gin.Context) {
	if setting.AirwallexWebhookSecret == "" {
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if !verifyAirwallexSignature(c.GetHeader("x-timestamp"), c.GetHeader("x-signature"), body) {
		logger.LogError(c.Request.Context(), "Airwallex webhook 签名校验失败")
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	var event airwallexEvent
	if err := common.Unmarshal(body, &event); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	ctx := c.Request.Context()
	switch event.Name {
	case "payment_consent.verified":
		handleAirwallexConsentVerified(c, event, body)
	case "subscription.active":
		handleAirwallexSubscriptionActive(c, event, body)
	case "subscription.unpaid", "subscription.cancelled":
		logger.LogInfo(ctx, fmt.Sprintf("Airwallex webhook %s: subscription=%v (term-end downgrade is engine-native)", event.Name, event.Data.Object["id"]))
	case "payment_intent.succeeded":
		handleAirwallexIntentSucceeded(c, event, body)
	default:
		logger.LogInfo(ctx, "Airwallex webhook ignored event: "+event.Name)
	}
	// Always 200 after signature-valid processing; Airwallex retries non-2xx.
	c.JSON(http.StatusOK, gin.H{"received": true})
}

func airwallexObjectString(obj map[string]any, key string) string {
	if v, ok := obj[key].(string); ok {
		return v
	}
	return ""
}

func airwallexObjectMetadata(obj map[string]any, key string) string {
	if md, ok := obj["metadata"].(map[string]any); ok {
		if v, ok := md[key].(string); ok {
			return v
		}
	}
	return ""
}

// handleAirwallexConsentVerified: HPP recurring checkout produced a verified
// merchant-triggered consent → create the managed Subscription for the user's
// latest pending Airwallex order. subscription.active then completes the order.
func handleAirwallexConsentVerified(c *gin.Context, event airwallexEvent, raw []byte) {
	ctx := c.Request.Context()
	consentId := airwallexObjectString(event.Data.Object, "id")
	customerId := airwallexObjectString(event.Data.Object, "customer_id")
	if consentId == "" || customerId == "" {
		return
	}
	customer, err := airwallex.GetCustomer(customerId)
	if err != nil {
		logger.LogError(ctx, "Airwallex consent.verified: 客户查询失败 "+err.Error())
		return
	}
	userId, err := strconv.Atoi(customer.MerchantCustomerId)
	if err != nil || userId <= 0 {
		logger.LogError(ctx, "Airwallex consent.verified: 无法映射用户 merchant_customer_id="+customer.MerchantCustomerId)
		return
	}
	order := model.GetLatestPendingSubscriptionOrder(userId, model.PaymentProviderAirwallex)
	if order == nil {
		logger.LogInfo(ctx, fmt.Sprintf("Airwallex consent.verified: 用户 %d 无待支付订阅订单，忽略", userId))
		return
	}
	if order.PaymentMethod == model.PaymentMethodWeChat {
		return // one-off branch never uses consents
	}
	plan, err := model.GetSubscriptionPlanById(order.PlanId)
	if err != nil || plan.AirwallexPriceId == "" {
		logger.LogError(ctx, fmt.Sprintf("Airwallex consent.verified: 订单 %s 套餐无效", order.TradeNo))
		return
	}
	_, err = airwallex.CreateSubscription(&airwallex.CreateSubscriptionRequest{
		RequestId:         order.TradeNo + "-sub",
		CustomerId:        customerId,
		BillingCustomerId: customerId,
		CollectionMethod:  "AUTO_CHARGE",
		PaymentSourceId:   consentId,
		PaymentConsentId:  consentId,
		Items:             []airwallex.SubscriptionItem{{PriceId: plan.AirwallexPriceId}},
		Recurring:         &airwallex.SubscriptionRecurring{Period: plan.DurationValue, PeriodUnit: strings.ToUpper(plan.DurationUnit)},
		Metadata:          map[string]string{"trade_no": order.TradeNo, "new_api_user_id": strconv.Itoa(userId)},
	})
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Airwallex 订阅创建失败 trade_no=%s error=%q", order.TradeNo, err.Error()))
		return
	}
	logger.LogInfo(ctx, fmt.Sprintf("Airwallex 订阅已创建 trade_no=%s consent=%s", order.TradeNo, consentId))
}

// handleAirwallexSubscriptionActive completes the pending order on first
// activation; a later cycle's event for an already-completed trade_no opens
// the next paid order so the engine extends the term (vendor-side renewal).
func handleAirwallexSubscriptionActive(c *gin.Context, event airwallexEvent, raw []byte) {
	ctx := c.Request.Context()
	tradeNo := airwallexObjectMetadata(event.Data.Object, "trade_no")
	if tradeNo == "" {
		logger.LogInfo(ctx, "Airwallex subscription.active without trade_no metadata, ignored")
		return
	}
	payload := common.GetJsonString(event.Data.Object)
	err := model.CompleteSubscriptionOrder(tradeNo, payload, model.PaymentProviderAirwallex, "")
	if err == nil {
		logger.LogInfo(ctx, "Airwallex 订阅订单完成 trade_no="+tradeNo)
		return
	}
	orig := model.GetSubscriptionOrderByTradeNo(tradeNo)
	if orig != nil && orig.Status == common.TopUpStatusSuccess {
		renewAirwallexSubscription(c, orig, payload)
		return
	}
	logger.LogError(ctx, fmt.Sprintf("Airwallex subscription.active 处理失败 trade_no=%s error=%v", tradeNo, err))
}

// renewAirwallexSubscription inserts + completes the next cycle's paid order.
// Trade no is derived from the original + billing month, so webhook retries stay idempotent.
func renewAirwallexSubscription(c *gin.Context, orig *model.SubscriptionOrder, payload string) {
	ctx := c.Request.Context()
	period := time.Now().UTC().Format("200601")
	renewTradeNo := fmt.Sprintf("%s-r%s", orig.TradeNo, period)
	if model.GetSubscriptionOrderByTradeNo(renewTradeNo) == nil {
		order := &model.SubscriptionOrder{
			UserId:          orig.UserId,
			PlanId:          orig.PlanId,
			Money:           orig.Money,
			TradeNo:         renewTradeNo,
			PaymentMethod:   orig.PaymentMethod,
			PaymentProvider: model.PaymentProviderAirwallex,
			CreateTime:      time.Now().Unix(),
			Status:          common.TopUpStatusPending,
		}
		if err := order.Insert(); err != nil {
			logger.LogError(ctx, fmt.Sprintf("Airwallex 续费订单创建失败 trade_no=%s error=%q", renewTradeNo, err.Error()))
			return
		}
	}
	if err := model.CompleteSubscriptionOrder(renewTradeNo, payload, model.PaymentProviderAirwallex, ""); err != nil {
		logger.LogError(ctx, fmt.Sprintf("Airwallex 续费订单完成失败 trade_no=%s error=%v", renewTradeNo, err))
		return
	}
	logger.LogInfo(ctx, "Airwallex 订阅续费完成 trade_no="+renewTradeNo)
}

// handleAirwallexIntentSucceeded completes one-off orders (the WeChat
// manual-renew branch; Stage-2 wallet top-ups will branch here by trade_no).
func handleAirwallexIntentSucceeded(c *gin.Context, event airwallexEvent, raw []byte) {
	ctx := c.Request.Context()
	tradeNo := airwallexObjectMetadata(event.Data.Object, "trade_no")
	if tradeNo == "" {
		tradeNo = airwallexObjectString(event.Data.Object, "merchant_order_id")
	}
	if !strings.HasPrefix(tradeNo, "sub_ref_") {
		logger.LogInfo(ctx, "Airwallex payment_intent.succeeded 非订阅订单，忽略 trade_no="+tradeNo)
		return
	}
	payload := common.GetJsonString(event.Data.Object)
	if err := model.CompleteSubscriptionOrder(tradeNo, payload, model.PaymentProviderAirwallex, ""); err != nil {
		if err != model.ErrSubscriptionOrderNotFound {
			logger.LogError(ctx, fmt.Sprintf("Airwallex payment_intent.succeeded 处理失败 trade_no=%s error=%v", tradeNo, err))
		}
		return
	}
	logger.LogInfo(ctx, "Airwallex 一次性订阅订单完成 trade_no="+tradeNo)
}
