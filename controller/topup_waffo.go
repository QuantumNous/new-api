package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"


	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
	waffo "github.com/waffo-com/waffo-go"
	"github.com/waffo-com/waffo-go/config"
	"github.com/waffo-com/waffo-go/core"
	"github.com/waffo-com/waffo-go/types/order"
)

func getWaffoSDK() (*waffo.Waffo, error) {
	env := config.Sandbox
	apiKey := setting.WaffoSandboxApiKey
	privateKey := setting.WaffoSandboxPrivateKey
	publicKey := setting.WaffoSandboxPublicKey
	if !setting.WaffoSandbox {
		env = config.Production
		apiKey = setting.WaffoApiKey
		privateKey = setting.WaffoPrivateKey
		publicKey = setting.WaffoPublicKey
	}
	builder := config.NewConfigBuilder().
		APIKey(apiKey).
		PrivateKey(privateKey).
		WaffoPublicKey(publicKey).
		Environment(env)
	if setting.WaffoMerchantId != "" {
		builder = builder.MerchantID(setting.WaffoMerchantId)
	}
	cfg, err := builder.Build()
	if err != nil {
		return nil, err
	}
	return waffo.New(cfg), nil
}

func getWaffoUserEmail(user *model.User) string {
	if user.Email != "" {
		return user.Email
	}
	return fmt.Sprintf("user_%d@noreply.local", user.Id)
}

func getWaffoCurrency() string {
	if setting.WaffoCurrency != "" {
		return setting.WaffoCurrency
	}
	return "USD"
}

// zeroDecimalCurrencies 零小数位币种，金额不能带小数点
var zeroDecimalCurrencies = map[string]bool{
	"IDR": true, "JPY": true, "KRW": true, "VND": true,
}

func formatWaffoAmount(amount float64, currency string) string {
	if zeroDecimalCurrencies[currency] {
		return fmt.Sprintf("%.0f", amount)
	}
	return fmt.Sprintf("%.2f", amount)
}

// getWaffoPayMoney converts the user-facing amount to USD for Waffo payment.
// Waffo only accepts USD, so this function handles the conversion from different
// display types (USD/CNY/TOKENS) to the actual USD amount to charge.
func getWaffoPayMoney(amount float64, group string) float64 {
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
	return amount * setting.WaffoUnitPrice * topupGroupRatio * discount
}

type WaffoPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`  // CREDITCARD, EWALLET, etc.
	PayMethodType string `json:"pay_method_type"` // Waffo API PayMethodType，如 CREDITCARD,DEBITCARD
	PayMethodName string `json:"pay_method_name"` // Waffo API PayMethodName，如 APPLEPAY
}

// getTopupPayMethodType returns the PayMethodType to pass to Waffo for one-time topup orders.
// Uses the value provided by the frontend directly; empty means not specified.
func getTopupPayMethodType(requestType string) string {
	return requestType
}

// RequestWaffoPay 创建 Waffo 支付订单
func RequestWaffoPay(c *gin.Context) {
	if !setting.WaffoEnabled {
		c.JSON(200, gin.H{"message": "error", "data": "Waffo 支付未启用"})
		return
	}

	var req WaffoPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	waffoMinTopup := int64(setting.WaffoMinTopUp)
	if req.Amount < waffoMinTopup {
		c.JSON(200, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", waffoMinTopup)})
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		c.JSON(200, gin.H{"message": "error", "data": "用户不存在"})
		return
	}

	group, _ := model.GetUserGroup(id, true)
	payMoney := getWaffoPayMoney(float64(req.Amount), group)
	if payMoney < 0.01 {
		c.JSON(200, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	// 生成唯一订单号
	merchantOrderId := fmt.Sprintf("WAFFO-%d-%d-%s", id, time.Now().UnixMilli(), randstr.String(4))
	paymentRequestId := fmt.Sprintf("PR-%d-%d-%s", id, time.Now().UnixMilli(), randstr.String(6))

	// 创建本地订单
	topUp := &model.TopUp{
		UserId:        id,
		Amount:        req.Amount,
		Money:         payMoney,
		TradeNo:       merchantOrderId,
		PaymentMethod: "waffo",
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		log.Printf("Waffo 创建本地订单失败: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	sdk, err := getWaffoSDK()
	if err != nil {
		log.Printf("Waffo SDK 初始化失败: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "支付配置错误"})
		return
	}

	callbackAddr := service.GetCallbackAddress()
	notifyUrl := callbackAddr + "/api/waffo/webhook"
	if setting.WaffoNotifyUrl != "" {
		notifyUrl = setting.WaffoNotifyUrl
	}
	returnUrl := system_setting.ServerAddress + "/console/topup?show_history=true"
	if setting.WaffoReturnUrl != "" {
		returnUrl = setting.WaffoReturnUrl
	}

	currency := getWaffoCurrency()
	createParams := &order.CreateOrderParams{
		PaymentRequestID: paymentRequestId,
		MerchantOrderID:  merchantOrderId,
		OrderAmount:      formatWaffoAmount(payMoney, currency),
		OrderCurrency:    currency,
		OrderDescription: fmt.Sprintf("充值 %d 额度", req.Amount),
		OrderRequestedAt: time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
		NotifyURL:        notifyUrl,
		MerchantInfo: &order.MerchantInfo{
			MerchantID: setting.WaffoMerchantId,
		},
		UserInfo: &order.UserInfo{
			UserID:       strconv.Itoa(user.Id),
			UserEmail:    getWaffoUserEmail(user),
			UserTerminal: "WEB",
		},
		PaymentInfo: &order.PaymentInfo{
			ProductName:   "ONE_TIME_PAYMENT",
			PayMethodType: getTopupPayMethodType(req.PayMethodType),
			PayMethodName: req.PayMethodName,
		},
		SuccessRedirectURL: returnUrl,
		FailedRedirectURL:  returnUrl,
	}
	resp, err := sdk.Order().Create(c.Request.Context(), createParams, nil)
	if err != nil {
		log.Printf("Waffo 创建订单失败: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}
	if !resp.IsSuccess() {
		log.Printf("Waffo 创建订单业务失败: [%s] %s, 完整响应: %+v", resp.Code, resp.Message, resp)
		c.JSON(200, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	orderData := resp.GetData()
	log.Printf("Waffo 订单创建成功 - 用户: %d, 订单: %s, 金额: %.2f", id, merchantOrderId, payMoney)

	// 存储 acquiringOrderId，退款时直接使用
	if orderData.AcquiringOrderID != "" {
		topUp.AcquiringOrderId = orderData.AcquiringOrderID
		if err := topUp.Update(); err != nil {
			log.Printf("Waffo 保存 acquiringOrderId 失败: %v, 订单: %s", err, merchantOrderId)
		}
	}

	paymentUrl := orderData.FetchRedirectURL()
	if paymentUrl == "" {
		paymentUrl = orderData.OrderAction
	}

	c.JSON(200, gin.H{
		"message": "success",
		"data": gin.H{
			"payment_url": paymentUrl,
			"order_id":    merchantOrderId,
		},
	})
}

// webhookPayloadWithSubInfo 扩展 PAYMENT_NOTIFICATION，包含 SDK 未定义的 subscriptionInfo 字段
type webhookPayloadWithSubInfo struct {
	EventType string `json:"eventType"`
	Result    struct {
		core.PaymentNotificationResult
		SubscriptionInfo *webhookSubscriptionInfo `json:"subscriptionInfo,omitempty"`
	} `json:"result"`
}

type webhookSubscriptionInfo struct {
	Period              string `json:"period,omitempty"`
	MerchantRequest     string `json:"merchantRequest,omitempty"`
	SubscriptionID      string `json:"subscriptionId,omitempty"`
	SubscriptionRequest string `json:"subscriptionRequest,omitempty"`
}

// WaffoWebhook 处理 Waffo 回调通知（支付/退款/订阅）
func WaffoWebhook(c *gin.Context) {
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Printf("Waffo Webhook 读取 body 失败: %v", err)
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	sdk, err := getWaffoSDK()
	if err != nil {
		log.Printf("Waffo Webhook SDK 初始化失败: %v", err)
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	wh := sdk.Webhook()
	bodyStr := string(bodyBytes)
	signature := c.GetHeader("X-SIGNATURE")

	// 验证请求签名
	if !wh.VerifySignature(bodyStr, signature) {
		log.Printf("Waffo Webhook 签名验证失败")
		sendWaffoWebhookResponse(c, wh, false, "signature verification failed")
		return
	}

	var event core.WebhookEvent
	if err := json.Unmarshal(bodyBytes, &event); err != nil {
		log.Printf("Waffo Webhook 解析失败: %v", err)
		sendWaffoWebhookResponse(c, wh, false, "invalid payload")
		return
	}

	switch event.EventType {
	case core.EventPayment:
		// 解析为扩展类型，区分普通支付和订阅支付
		var payload webhookPayloadWithSubInfo
		if err := json.Unmarshal(bodyBytes, &payload); err != nil {
			sendWaffoWebhookResponse(c, wh, false, "invalid payment payload")
			return
		}
		log.Printf("Waffo Webhook - EventType: %s, MerchantOrderId: %s, OrderStatus: %s",
			event.EventType, payload.Result.MerchantOrderID, payload.Result.OrderStatus)
		if payload.Result.SubscriptionInfo != nil {
			handleWaffoSubscriptionPayment(c, wh, &payload)
		} else {
			handleWaffoPayment(c, wh, &payload.Result.PaymentNotificationResult)
		}
	case core.EventRefund:
		var notification core.RefundNotification
		if err := json.Unmarshal(bodyBytes, &notification); err != nil {
			sendWaffoWebhookResponse(c, wh, false, "invalid refund payload")
			return
		}
		handleWaffoRefund(c, wh, &notification)
	case core.EventSubscriptionStatus:
		var notification core.SubscriptionStatusNotification
		if err := json.Unmarshal(bodyBytes, &notification); err != nil {
			sendWaffoWebhookResponse(c, wh, false, "invalid subscription status payload")
			return
		}
		log.Printf("Waffo Webhook - EventType: %s, MerchantSubscriptionId: %s, SubscriptionStatus: %s",
			event.EventType, notification.Result.MerchantSubscriptionID, notification.Result.SubscriptionStatus)
		handleWaffoSubscriptionStatus(c, wh, &notification, bodyBytes)
	case core.EventSubscriptionPeriodChanged:
		var notification core.SubscriptionPeriodChangedNotification
		if err := json.Unmarshal(bodyBytes, &notification); err != nil {
			sendWaffoWebhookResponse(c, wh, false, "invalid subscription renewal payload")
			return
		}
		log.Printf("Waffo Webhook - EventType: %s, MerchantSubscriptionId: %s, SubscriptionStatus: %s",
			event.EventType, notification.Result.MerchantSubscriptionID, notification.Result.SubscriptionStatus)
		handleWaffoSubscriptionRenewal(c, wh, &notification, bodyBytes)
	default:
		log.Printf("Waffo Webhook 未知事件: %s", event.EventType)
		sendWaffoWebhookResponse(c, wh, true, "")
	}
}

// handleWaffoPayment 处理支付完成通知
func handleWaffoPayment(c *gin.Context, wh *core.WebhookHandler, result *core.PaymentNotificationResult) {
	if result.OrderStatus != "PAY_SUCCESS" {
		log.Printf("Waffo 订单状态非成功: %s", result.OrderStatus)
		sendWaffoWebhookResponse(c, wh, true, "")
		return
	}

	merchantOrderId := result.MerchantOrderID

	LockOrder(merchantOrderId)
	defer UnlockOrder(merchantOrderId)

	if err := model.RechargeWaffo(merchantOrderId); err != nil {
		log.Printf("Waffo 充值处理失败: %v, 订单: %s", err, merchantOrderId)
		sendWaffoWebhookResponse(c, wh, false, err.Error())
		return
	}

	log.Printf("Waffo 充值成功 - 订单: %s", merchantOrderId)
	sendWaffoWebhookResponse(c, wh, true, "")
}

// handleWaffoRefund 处理退款通知，更新退款状态并扣减用户额度。
func handleWaffoRefund(c *gin.Context, wh *core.WebhookHandler, notification *core.RefundNotification) {
	if notification.Result == nil {
		sendWaffoWebhookResponse(c, wh, true, "")
		return
	}
	refundRequestId := notification.Result.RefundRequestID
	refundStatus := notification.Result.RefundStatus

	log.Printf("Waffo 退款通知 - RefundRequestId: %s, Status: %s", refundRequestId, refundStatus)

	if refundRequestId == "" {
		sendWaffoWebhookResponse(c, wh, true, "")
		return
	}

	LockOrder(refundRequestId)
	defer UnlockOrder(refundRequestId)

	refund := model.GetRefundByRequestId(refundRequestId)
	if refund == nil {
		log.Printf("Waffo 退款通知：未找到退款记录 RefundRequestId: %s", refundRequestId)
		sendWaffoWebhookResponse(c, wh, true, "")
		return
	}

	// 幂等：已终态则跳过
	if refund.Status == common.RefundStatusSuccess || refund.Status == common.RefundStatusFailed {
		log.Printf("Waffo 退款通知：已处理，跳过 RefundRequestId: %s, CurrentStatus: %s", refundRequestId, refund.Status)
		sendWaffoWebhookResponse(c, wh, true, "")
		return
	}

	switch refundStatus {
	case core.RefundStatusFullyRefunded, core.RefundStatusPartiallyRefunded:
		if err := model.CompleteRefund(refundRequestId); err != nil {
			log.Printf("Waffo 退款处理失败: %v, RefundRequestId: %s", err, refundRequestId)
			sendWaffoWebhookResponse(c, wh, false, "complete refund failed")
			return
		}
		model.RecordLog(refund.UserId, model.LogTypeTopup, fmt.Sprintf(
			"Waffo 退款成功 RefundRequestId: %s，退款金额: %.2f，扣减额度: %d",
			refundRequestId, refund.RefundAmount, refund.QuotaDeduction,
		))
		log.Printf("Waffo 退款成功 - RefundRequestId: %s, Status: %s", refundRequestId, refundStatus)
	case core.RefundStatusFailed:
		if err := model.FailRefund(refundRequestId); err != nil {
			log.Printf("Waffo 退款失败标记错误: %v, RefundRequestId: %s", err, refundRequestId)
		}
		log.Printf("Waffo 退款失败 - RefundRequestId: %s", refundRequestId)
	case core.RefundStatusInProgress:
		log.Printf("Waffo 退款处理中（异步）- RefundRequestId: %s", refundRequestId)
	default:
		log.Printf("Waffo 退款通知未知状态: %s, RefundRequestId: %s", refundStatus, refundRequestId)
	}

	sendWaffoWebhookResponse(c, wh, true, "")
}

// handleWaffoSubscriptionPayment 处理订阅扣款通知（PAYMENT_NOTIFICATION 中含 subscriptionInfo）。
// 设计说明：仅记录日志，不在此处分配/续期额度。Waffo 每次订阅扣款会触发两个事件：
//  1. PAYMENT_NOTIFICATION（含 subscriptionInfo）— 通知"钱已扣"
//  2. SUBSCRIPTION_STATUS_NOTIFICATION（首次）或 SUBSCRIPTION_PERIOD_CHANGED_NOTIFICATION（续期）— 通知"订阅状态已变"
// 额度分配/续期逻辑挂在第 2 个事件上（handleWaffoSubscriptionStatus / handleWaffoSubscriptionRenewal），
// 若在此处也处理会导致重复分配额度。
func handleWaffoSubscriptionPayment(c *gin.Context, wh *core.WebhookHandler, payload *webhookPayloadWithSubInfo) {
	if payload.Result.OrderStatus != "PAY_SUCCESS" {
		log.Printf("Waffo 订阅支付状态非成功: %s", payload.Result.OrderStatus)
		sendWaffoWebhookResponse(c, wh, true, "")
		return
	}

	subInfo := payload.Result.SubscriptionInfo
	log.Printf("Waffo 订阅支付成功 - AcquiringOrderId: %s, SubscriptionRequest: %s, Period: %s",
		payload.Result.AcquiringOrderID, subInfo.SubscriptionRequest, subInfo.Period)
	sendWaffoWebhookResponse(c, wh, true, "")
}

// handleWaffoSubscriptionStatus 处理首期订阅激活 / 关单 / 取消（SUBSCRIPTION_STATUS_NOTIFICATION）
func handleWaffoSubscriptionStatus(c *gin.Context, wh *core.WebhookHandler, notification *core.SubscriptionStatusNotification, rawBody []byte) {
	merchantSubscriptionId := notification.Result.MerchantSubscriptionID

	if merchantSubscriptionId == "" {
		sendWaffoWebhookResponse(c, wh, true, "")
		return
	}

	switch notification.Result.SubscriptionStatus {
	case "ACTIVE":
		LockOrder(merchantSubscriptionId)
		defer UnlockOrder(merchantSubscriptionId)
		if err := model.CompleteSubscriptionOrder(merchantSubscriptionId, string(rawBody)); err == nil {
			log.Printf("Waffo 订阅订单完成 - MerchantSubscriptionId: %s", merchantSubscriptionId)
		} else if !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
			log.Printf("Waffo 订阅订单处理失败: %v, MerchantSubscriptionId: %s", err, merchantSubscriptionId)
			sendWaffoWebhookResponse(c, wh, false, "complete subscription order failed")
			return
		}
	case "CLOSE", "CANCELLED", "EXPIRED":
		LockOrder(merchantSubscriptionId)
		defer UnlockOrder(merchantSubscriptionId)
		if err := model.ExpireSubscriptionOrder(merchantSubscriptionId); err != nil {
			if !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
				log.Printf("Waffo 过期订阅订单失败: %v, MerchantSubscriptionId: %s", err, merchantSubscriptionId)
			}
		} else {
			log.Printf("Waffo 订阅订单已过期 - MerchantSubscriptionId: %s", merchantSubscriptionId)
		}
	}

	sendWaffoWebhookResponse(c, wh, true, "")
}

// handleWaffoSubscriptionRenewal 处理续期扣款成功（SUBSCRIPTION_PERIOD_CHANGED_NOTIFICATION）
func handleWaffoSubscriptionRenewal(c *gin.Context, wh *core.WebhookHandler, notification *core.SubscriptionPeriodChangedNotification, rawBody []byte) {
	merchantSubscriptionId := notification.Result.MerchantSubscriptionID

	if merchantSubscriptionId == "" {
		sendWaffoWebhookResponse(c, wh, true, "")
		return
	}

	LockOrder(merchantSubscriptionId)
	defer UnlockOrder(merchantSubscriptionId)

	if err := model.RenewSubscriptionOrder(merchantSubscriptionId, string(rawBody)); err != nil {
		if !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
			log.Printf("Waffo 订阅续期失败: %v, MerchantSubscriptionId: %s", err, merchantSubscriptionId)
			sendWaffoWebhookResponse(c, wh, false, "renew subscription failed")
			return
		}
		log.Printf("Waffo 续期订单未找到: %s", merchantSubscriptionId)
	} else {
		log.Printf("Waffo 订阅续期成功 - MerchantSubscriptionId: %s", merchantSubscriptionId)
	}

	sendWaffoWebhookResponse(c, wh, true, "")
}

// sendWaffoWebhookResponse 发送签名响应
func sendWaffoWebhookResponse(c *gin.Context, wh *core.WebhookHandler, success bool, msg string) {
	var body, sig string
	if success {
		body, sig = wh.BuildSuccessResponse()
	} else {
		body, sig = wh.BuildFailedResponse(msg)
	}
	c.Header("X-SIGNATURE", sig)
	c.Data(http.StatusOK, "application/json", []byte(body))
}
