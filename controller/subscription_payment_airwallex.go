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

// getBillingSubscription is a seam so webhook tests can resolve a subscription
// without a live Airwallex call.
var getBillingSubscription = airwallex.GetBillingSubscription

// getBillingCheckout is a seam so webhook tests can re-fetch a checkout without a
// live Airwallex call.
var getBillingCheckout = airwallex.GetBillingCheckout

// getBillingSubscriptionItems is a seam so webhook tests can read a
// subscription's current price without a live Airwallex call.
var getBillingSubscriptionItems = airwallex.GetBillingSubscriptionItems

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

	// Auto-renew methods (card / applepay / googlepay / alipay) use a hosted
	// Billing Checkout in SUBSCRIPTION mode. Airwallex creates the managed
	// subscription server-side; billing_checkout.completed then activates us.
	// WeChat is handled above (one-off intent) — it is not a valid Billing
	// SUBSCRIPTION payment_method_type.
	billingCustomerId := model.GetAirwallexBillingCustomerId(user.Id)
	if billingCustomerId == "" {
		cust, err := airwallex.CreateBillingCustomer(tradeNo+"-bcus", user.Email,
			map[string]string{"new_api_user_id": strconv.Itoa(user.Id)})
		if err != nil {
			return "", err
		}
		if err := model.SaveAirwallexBillingCustomerId(user.Id, cust.Id); err != nil {
			return "", err
		}
		billingCustomerId = cust.Id
	}

	checkout, err := airwallex.CreateBillingCheckout(&airwallex.CreateBillingCheckoutRequest{
		RequestId:         tradeNo + "-co",
		Mode:              "SUBSCRIPTION",
		UiMode:            "HOSTED",
		BillingCustomerId: billingCustomerId,
		LineItems:         []airwallex.BillingCheckoutLineItem{{PriceId: plan.AirwallexPriceId, Quantity: 1}},
		PaymentOptions:    map[string]any{"payment_method_types": airwallexMethodNames[method]},
		SubscriptionData: map[string]any{
			"metadata": map[string]string{"trade_no": tradeNo, "new_api_user_id": strconv.Itoa(user.Id)},
		},
		Metadata: map[string]string{"trade_no": tradeNo, "new_api_user_id": strconv.Itoa(user.Id)},
		Locale:   "AUTO",
		// HOSTED Billing Checkout uses success_url for the post-payment redirect.
		// return_url is only valid for embedded/redirect ui_modes; sending it with
		// ui_mode=HOSTED triggers a validation_error and no checkout url is returned.
		SuccessUrl: returnUrl,
	})
	if err != nil {
		return "", err
	}
	if checkout.Url == "" {
		return "", fmt.Errorf("airwallex billing checkout empty url (status %s)", checkout.Status)
	}
	return checkout.Url, nil
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
	billingCustomerId := model.GetAirwallexBillingCustomerId(userId)
	if billingCustomerId == "" {
		common.ApiErrorMsg(c, "无进行中的订阅")
		return
	}
	subs, err := airwallex.ListBillingSubscriptions(billingCustomerId, "ACTIVE")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	cancelled := 0
	for _, sub := range subs {
		reqId := fmt.Sprintf("cancel-%s-%d", sub.Id, time.Now().UnixMilli())
		if err := airwallex.CancelBillingSubscription(sub.Id, reqId, "NONE"); err != nil {
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

// listBillingSubscriptions / switchBillingSubscriptionPrice are seams so
// change-plan tests can run without live Airwallex calls.
var listBillingSubscriptions = airwallex.ListBillingSubscriptions
var switchBillingSubscriptionPrice = airwallex.SwitchBillingSubscriptionPrice

type SubscriptionAirwallexChangePlanRequest struct {
	PlanId int `json:"plan_id"`
}

// SubscriptionChangePlanAirwallex switches the caller's live subscription onto an
// annual plan with Claude-style semantics: unused time on the monthly price is
// credited, the annual price is charged immediately, and the billing anchor
// resets to now.
//
// Monthly→annual only, and only within the same tier. The local plan row is NOT
// updated here — the proration invoice's webhook owns that (see
// handleAirwallexInvoicePaid), which keeps a single write path and removes any
// endpoint-vs-webhook race.
func SubscriptionChangePlanAirwallex(c *gin.Context) {
	if msg := airwallexConfigured(); msg != "" {
		common.ApiErrorMsg(c, msg)
		return
	}
	var req SubscriptionAirwallexChangePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	target, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !target.Enabled {
		common.ApiErrorMsg(c, "套餐未启用")
		return
	}
	if target.AirwallexPriceId == "" {
		common.ApiErrorMsg(c, "该套餐未配置 AirwallexPriceId")
		return
	}
	if target.DurationUnit != model.SubscriptionDurationYear {
		common.ApiErrorMsg(c, "仅支持切换到年付套餐")
		return
	}

	userId := c.GetInt("id")
	billingCustomerId := model.GetAirwallexBillingCustomerId(userId)
	if billingCustomerId == "" {
		common.ApiErrorMsg(c, "无进行中的订阅")
		return
	}
	subs, err := listBillingSubscriptions(billingCustomerId, "ACTIVE")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(subs) == 0 {
		common.ApiErrorMsg(c, "无进行中的订阅")
		return
	}
	if len(subs) > 1 {
		// Ambiguous: switching one of several would leave the others billing.
		logger.LogError(c.Request.Context(), fmt.Sprintf("Airwallex 切换套餐：用户 %d 有 %d 个活跃订阅", userId, len(subs)))
		common.ApiErrorMsg(c, "订阅状态异常，请联系客服")
		return
	}
	sub := subs[0]

	items, err := getBillingSubscriptionItems(sub.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(items) != 1 {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Airwallex 切换套餐：订阅 %s 有 %d 个明细", sub.Id, len(items)))
		common.ApiErrorMsg(c, "订阅状态异常，请联系客服")
		return
	}
	item := items[0]
	if item.Price.Id == target.AirwallexPriceId {
		common.ApiErrorMsg(c, "已是该套餐")
		return
	}
	current, err := model.GetSubscriptionPlanByAirwallexPriceId(item.Price.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if current == nil {
		common.ApiErrorMsg(c, "当前套餐无法识别，请联系客服")
		return
	}
	if current.DurationUnit == model.SubscriptionDurationYear {
		common.ApiErrorMsg(c, "当前已是年付套餐，无需切换")
		return
	}
	if current.UpgradeGroup != target.UpgradeGroup {
		common.ApiErrorMsg(c, "仅支持同一档位内切换为年付")
		return
	}

	reqId := fmt.Sprintf("switch-%s-%d", sub.Id, time.Now().UnixMilli())
	if err := switchBillingSubscriptionPrice(sub.Id, reqId, item.Id, target.AirwallexPriceId); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Airwallex 切换套餐失败 sub=%s error=%q", sub.Id, err.Error()))
		common.ApiErrorMsg(c, "切换套餐失败，请稍后重试")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"switched": true}})
}

// ---- webhook ----

type airwallexEvent struct {
	Id   string             `json:"id"`
	Name string             `json:"name"`
	Data airwallexEventData `json:"data"`
}

// airwallexEventData normalizes the two webhook envelope shapes Airwallex emits.
// Payment Acceptance events (payment_intent.*, payment_consent.*, customer.*)
// nest the resource under data.object, whereas Billing events
// (billing_checkout.*, invoice.*, subscription.*) place the resource fields
// DIRECTLY under data with no "object" wrapper. Object exposes the resource for
// either shape. Reading only data.object silently dropped every Billing event —
// the 2026-07-08 charged-but-not-upgraded incident.
type airwallexEventData struct {
	Object map[string]any
}

func (d *airwallexEventData) UnmarshalJSON(b []byte) error {
	var m map[string]any
	if err := common.Unmarshal(b, &m); err != nil {
		return err
	}
	if obj, ok := m["object"].(map[string]any); ok {
		d.Object = obj
	} else {
		d.Object = m
	}
	return nil
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
	var handlerErr error
	switch event.Name {
	case "billing_checkout.completed":
		handlerErr = handleAirwallexBillingCheckoutCompleted(c, event)
	case "invoice.paid", "invoice.payment.paid":
		// Airwallex Billing emits invoice.payment.paid (not invoice.paid) for the
		// version pinned on our endpoint; accept both so renewals route correctly.
		handlerErr = handleAirwallexInvoicePaid(c, event)
	case "subscription.cancelled", "subscription.unpaid":
		logger.LogInfo(ctx, fmt.Sprintf("Airwallex webhook %s: subscription=%v (term-end downgrade is engine-native)", event.Name, event.Data.Object["id"]))
	case "payment_intent.succeeded":
		handlerErr = handleAirwallexIntentSucceeded(c, event, body)
	default:
		logger.LogInfo(ctx, "Airwallex webhook ignored event: "+event.Name)
	}
	if handlerErr != nil {
		logger.LogError(ctx, fmt.Sprintf("Airwallex webhook handler failed event=%s err=%v", event.Name, handlerErr))
		c.JSON(http.StatusInternalServerError, gin.H{"received": false})
		return
	}
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

// handleAirwallexBillingCheckoutCompleted handles the billing_checkout.completed
// event. It resolves trade_no from the event object metadata (falling back to a
// re-fetch if absent) and completes the pending subscription order.
func handleAirwallexBillingCheckoutCompleted(c *gin.Context, event airwallexEvent) error {
	ctx := c.Request.Context()
	tradeNo := airwallexObjectMetadata(event.Data.Object, "trade_no")
	subscriptionId := airwallexObjectString(event.Data.Object, "subscription_id")
	if tradeNo == "" {
		// Slim webhook object — re-fetch by checkout id.
		checkoutId := airwallexObjectString(event.Data.Object, "id")
		if checkoutId != "" {
			co, err := getBillingCheckout(checkoutId)
			if err != nil {
				return fmt.Errorf("Airwallex billing_checkout.completed: 重新获取checkout失败 id=%s: %w", checkoutId, err)
			}
			if co.Metadata != nil {
				tradeNo = co.Metadata["trade_no"]
			}
			// SUBSCRIPTION-mode checkouts may carry our metadata under
			// subscription_data.metadata instead of the top-level checkout
			// metadata — check both before falling through to the subscription.
			if tradeNo == "" && co.SubscriptionData.Metadata != nil {
				tradeNo = co.SubscriptionData.Metadata["trade_no"]
			}
			if subscriptionId == "" {
				subscriptionId = co.SubscriptionId
			}
		}
	}
	if tradeNo == "" && subscriptionId != "" {
		// SUBSCRIPTION-mode checkouts persist our metadata on the managed
		// subscription (subscription_data.metadata), not the checkout object —
		// same as invoice.paid. Resolve trade_no from the subscription as the
		// final fallback before giving up.
		sub, err := getBillingSubscription(subscriptionId)
		if err != nil {
			return fmt.Errorf("Airwallex billing_checkout.completed: 订阅查询失败 sub=%s: %w", subscriptionId, err)
		}
		if sub.Metadata != nil {
			tradeNo = sub.Metadata["trade_no"]
		}
	}
	if tradeNo == "" {
		logger.LogInfo(ctx, "Airwallex billing_checkout.completed: 无 trade_no metadata，忽略 sub="+subscriptionId)
		return nil
	}
	payload := common.GetJsonString(event.Data.Object)
	if err := model.CompleteSubscriptionOrder(tradeNo, payload, model.PaymentProviderAirwallex, ""); err != nil {
		if err == model.ErrSubscriptionOrderNotFound {
			logger.LogInfo(ctx, "Airwallex billing_checkout.completed: 订单未找到 trade_no="+tradeNo+"，忽略")
			return nil
		}
		return fmt.Errorf("Airwallex billing_checkout.completed 处理失败 trade_no=%s: %w", tradeNo, err)
	}
	logger.LogInfo(ctx, "Airwallex 订阅订单完成 trade_no="+tradeNo)
	return nil
}

// airwallexFirstCycleWindow bounds how long after the original order's creation
// an invoice can still be the first-cycle one. The shortest plan period is a
// month, so a renewal invoice is always created ≥ ~30 days after the order;
// the first invoice is created within minutes of checkout.
const airwallexFirstCycleWindow = 7 * 24 * time.Hour

// parseAirwallexTime parses Billing timestamps ("2026-07-07T23:40:06+0000",
// also tolerating strict RFC3339).
func parseAirwallexTime(s string) (time.Time, bool) {
	for _, layout := range []string{"2006-01-02T15:04:05-0700", time.RFC3339} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

// isAirwallexFirstCycleInvoice reports whether the invoice object is the
// subscription's first-cycle invoice, judged from the invoice itself rather
// than local order state: the per-subscription sequence in `number`
// (INV-XXXXXXXX-0001), or `created_at` falling inside the first-cycle window
// of the original order. Both signals are intrinsic to the invoice, so delayed
// or re-ordered webhook deliveries cannot change the answer.
func isAirwallexFirstCycleInvoice(obj map[string]any, orig *model.SubscriptionOrder) bool {
	if strings.HasSuffix(airwallexObjectString(obj, "number"), "-0001") {
		return true
	}
	if created, ok := parseAirwallexTime(airwallexObjectString(obj, "created_at")); ok {
		return created.Unix() < orig.CreateTime+int64(airwallexFirstCycleWindow/time.Second)
	}
	return false
}

// handleAirwallexInvoicePaid handles the invoice.paid event. The invoice object
// carries no metadata, so trade_no is resolved via the managed subscription
// (getBillingSubscription seam allows override in tests). First-cycle invoices
// are skipped (billing_checkout.completed owns activation) — detected from the
// invoice's own sequence/created_at, NOT from the local order status: the two
// first-cycle events race, and a retried delivery can arrive after the checkout
// event completed the order. Subsequent cycles create+complete a renewal order
// keyed on the invoice id.
func handleAirwallexInvoicePaid(c *gin.Context, event airwallexEvent) error {
	ctx := c.Request.Context()
	subId := airwallexObjectString(event.Data.Object, "subscription_id")
	if subId == "" {
		logger.LogInfo(ctx, "Airwallex invoice.paid: 无 subscription_id，忽略")
		return nil
	}
	invoiceId := airwallexObjectString(event.Data.Object, "id")
	if invoiceId == "" {
		// No invoice id means no idempotency key — creating an order would risk
		// duplicates on redelivery. Real Billing events always carry one.
		logger.LogError(ctx, "Airwallex invoice.paid: 无 invoice id，忽略 sub="+subId)
		return nil
	}
	sub, err := getBillingSubscription(subId)
	if err != nil {
		return fmt.Errorf("Airwallex invoice.paid: 订阅查询失败 sub=%s: %w", subId, err)
	}
	tradeNo := ""
	if sub.Metadata != nil {
		tradeNo = sub.Metadata["trade_no"]
	}
	if tradeNo == "" {
		logger.LogInfo(ctx, "Airwallex invoice.paid: 无 trade_no metadata sub="+subId+"，忽略")
		return nil
	}
	orig := model.GetSubscriptionOrderByTradeNo(tradeNo)
	if orig == nil {
		logger.LogInfo(ctx, "Airwallex invoice.paid: 订单未找到 trade_no="+tradeNo+"，忽略")
		return nil
	}
	if orig.Status != common.TopUpStatusSuccess {
		// First cycle not yet activated — billing_checkout.completed owns it.
		logger.LogInfo(ctx, "Airwallex invoice.paid: 原订单未完成，跳过（由 billing_checkout.completed 激活）trade_no="+tradeNo)
		return nil
	}

	// The subscription's current price is authoritative over orig.PlanId: a
	// monthly→annual switch repoints the price, and its proration invoice
	// arrives looking like an ordinary renewal. Resolving the plan here is what
	// stops a switch from granting another month of the OLD plan.
	planId := orig.PlanId
	planChanged := false
	if items, err := getBillingSubscriptionItems(subId); err != nil {
		// Unreachable Airwallex must not strand a paid invoice; fall back to the
		// order's plan (correct for the common case: an ordinary renewal).
		logger.LogError(ctx, "Airwallex invoice.paid: 订阅明细查询失败 sub="+subId+" error="+err.Error())
	} else {
		for _, item := range items {
			livePlan, err := model.GetSubscriptionPlanByAirwallexPriceId(item.Price.Id)
			if err != nil {
				logger.LogError(ctx, "Airwallex invoice.paid: 套餐查询失败 price="+item.Price.Id+" error="+err.Error())
				break
			}
			if livePlan != nil {
				if livePlan.Id != orig.PlanId {
					planChanged = true
				}
				planId = livePlan.Id
				break
			}
		}
	}

	// The first-cycle skip protects against double-granting the signup invoice.
	// A plan change overrides it: that invoice is a real, distinct charge, and
	// a switch within 7 days of signup would otherwise be silently dropped.
	if !planChanged && isAirwallexFirstCycleInvoice(event.Data.Object, orig) {
		logger.LogInfo(ctx, "Airwallex invoice.paid: 首次周期发票，跳过 invoice="+invoiceId+" trade_no="+tradeNo)
		return nil
	}

	payload := common.GetJsonString(event.Data.Object)
	if err := renewAirwallexSubscriptionBilling(c, orig, payload, invoiceId, planId); err != nil {
		return err
	}
	if planChanged {
		oldPlanId := orig.PlanId
		// Repoint the anchor order so every later renewal grants the new plan.
		orig.PlanId = planId
		if err := orig.Update(); err != nil {
			return fmt.Errorf("Airwallex 套餐切换后原订单更新失败 trade_no=%s: %w", tradeNo, err)
		}
		n, err := model.ExpireSupersededUserSubscriptions(orig.UserId, oldPlanId, 0)
		if err != nil {
			return fmt.Errorf("Airwallex 旧订阅过期失败 user=%d: %w", orig.UserId, err)
		}
		logger.LogInfo(ctx, fmt.Sprintf("Airwallex 套餐切换完成 user=%d %d→%d 过期旧订阅%d条", orig.UserId, oldPlanId, planId, n))
	}
	return nil
}

// renewAirwallexSubscriptionBilling inserts + completes the next cycle's paid
// order. Trade no embeds the Airwallex invoice id, so webhook redeliveries stay
// idempotent regardless of when they are processed, and distinct invoices never
// collapse. planId comes from the caller, which resolves it from the
// subscription's live price — it differs from orig.PlanId across a plan
// switch. Returns error so callers receive 500 on DB failure.
func renewAirwallexSubscriptionBilling(c *gin.Context, orig *model.SubscriptionOrder, payload string, invoiceId string, planId int) error {
	ctx := c.Request.Context()
	renewTradeNo := fmt.Sprintf("%s-r-%s", orig.TradeNo, invoiceId)
	if model.GetSubscriptionOrderByTradeNo(renewTradeNo) == nil {
		order := &model.SubscriptionOrder{
			UserId: orig.UserId,
			// planId is the plan the subscription is CURRENTLY on, which differs
			// from orig.PlanId across a plan switch.
			PlanId: planId,
			// Money is the original order's amount (a historical record for the
			// renewal row); the authoritative charge is Airwallex-side. If the
			// plan price changes mid-subscription these can diverge — acceptable.
			Money:           orig.Money,
			TradeNo:         renewTradeNo,
			PaymentMethod:   orig.PaymentMethod,
			PaymentProvider: model.PaymentProviderAirwallex,
			CreateTime:      time.Now().Unix(),
			Status:          common.TopUpStatusPending,
		}
		if err := order.Insert(); err != nil {
			return fmt.Errorf("Airwallex 续费订单创建失败 trade_no=%s: %w", renewTradeNo, err)
		}
	}
	if err := model.CompleteSubscriptionOrder(renewTradeNo, payload, model.PaymentProviderAirwallex, ""); err != nil {
		return fmt.Errorf("Airwallex 续费订单完成失败 trade_no=%s: %w", renewTradeNo, err)
	}
	logger.LogInfo(ctx, "Airwallex 订阅续费完成 trade_no="+renewTradeNo)
	return nil
}

// handleAirwallexIntentSucceeded completes one-off orders (the WeChat
// manual-renew branch; Stage-2 wallet top-ups will branch here by trade_no).
func handleAirwallexIntentSucceeded(c *gin.Context, event airwallexEvent, raw []byte) error {
	ctx := c.Request.Context()
	tradeNo := airwallexObjectMetadata(event.Data.Object, "trade_no")
	if tradeNo == "" {
		tradeNo = airwallexObjectString(event.Data.Object, "merchant_order_id")
	}
	if !strings.HasPrefix(tradeNo, "sub_ref_") {
		logger.LogInfo(ctx, "Airwallex payment_intent.succeeded 非订阅订单，忽略 trade_no="+tradeNo)
		return nil
	}
	payload := common.GetJsonString(event.Data.Object)
	if err := model.CompleteSubscriptionOrder(tradeNo, payload, model.PaymentProviderAirwallex, ""); err != nil {
		if err == model.ErrSubscriptionOrderNotFound {
			return nil
		}
		return fmt.Errorf("Airwallex payment_intent.succeeded 处理失败 trade_no=%s: %w", tradeNo, err)
	}
	logger.LogInfo(ctx, "Airwallex 一次性订阅订单完成 trade_no="+tradeNo)
	return nil
}
