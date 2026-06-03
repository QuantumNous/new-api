package controller

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
)

type SubscriptionAlipayPayRequest struct {
	PlanId        int    `json:"plan_id"`
	PaymentMethod string `json:"payment_method"`
}

func SubscriptionRequestAlipayPay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	if !isAlipayTopUpEnabled() {
		common.ApiErrorMsg(c, "支付宝支付未启用")
		return
	}
	var req SubscriptionAlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if req.PaymentMethod == "" {
		req.PaymentMethod = model.PaymentMethodAlipayPC
	}
	if req.PaymentMethod != model.PaymentMethodAlipayPC && req.PaymentMethod != model.PaymentMethodAlipayH5 {
		common.ApiErrorMsg(c, "不支持的支付宝支付方式")
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
	if plan.PriceAmount < 0.01 {
		common.ApiErrorMsg(c, "套餐金额过低")
		return
	}
	userId := c.GetInt("id")
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
	config, err := getDecryptedPaymentConfig(model.PaymentProviderAlipay)
	if err != nil {
		common.ApiErrorMsg(c, "支付宝支付未配置")
		return
	}
	tradeNo := fmt.Sprintf("SUB-ALIPAY-%d-%d-%s", userId, time.Now().UnixMilli(), randstr.String(6))
	order := &model.SubscriptionOrder{UserId: userId, PlanId: plan.Id, Money: plan.PriceAmount, TradeNo: tradeNo, PaymentMethod: req.PaymentMethod, PaymentProvider: model.PaymentProviderAlipay, CreateTime: time.Now().Unix(), Status: common.TopUpStatusPending}
	if err := order.Insert(); err != nil {
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}
	returnURL := paymentReturnPath("/console/topup?show_history=true")
	client, err := service.NewAlipayPayClient(config, "/api/subscription/alipay/notify", returnURL)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝订阅支付 SDK初始化失败 trade_no=%s error=%q", tradeNo, err.Error()))
		_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderAlipay)
		common.ApiErrorMsg(c, "支付配置错误")
		return
	}
	totalAmount := strconv.FormatFloat(plan.PriceAmount, 'f', 2, 64)
	subject := fmt.Sprintf("订阅套餐:%s", plan.Title)
	expireTime := time.Now().Add(30 * time.Minute).Format("2006-01-02 15:04:05")
	var payURL string
	switch req.PaymentMethod {
	case model.PaymentMethodAlipayPC:
		payURL, err = client.CreatePagePay(tradeNo, subject, totalAmount, expireTime)
	case model.PaymentMethodAlipayH5:
		payURL, err = client.CreateWAPPay(tradeNo, subject, totalAmount, expireTime, returnURL)
	}
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝订阅支付 拉起失败 trade_no=%s error=%q", tradeNo, err.Error()))
		_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderAlipay)
		common.ApiErrorMsg(c, "拉起支付失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"pay_url": payURL, "trade_no": tradeNo}})
}

func SubscriptionAlipayNotify(c *gin.Context) {
	if !isAlipayWebhookEnabled() {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	config, err := getDecryptedPaymentConfig(model.PaymentProviderAlipay)
	if err != nil {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	client, err := service.NewAlipayPayClient(config, "/api/subscription/alipay/notify", paymentReturnPath("/console/topup?show_history=true"))
	if err != nil {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	if err := c.Request.ParseForm(); err != nil {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	params := url.Values(c.Request.Form)
	if err := client.VerifyNotification(c.Request.Context(), params); err != nil {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	tradeNo := params.Get("out_trade_no")
	tradeStatus := params.Get("trade_status")
	if tradeStatus != "TRADE_SUCCESS" && tradeStatus != "TRADE_FINISHED" {
		if tradeStatus == "TRADE_CLOSED" {
			_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderAlipay)
		}
		_, _ = c.Writer.Write([]byte("success"))
		return
	}
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if err := model.CompleteSubscriptionOrder(tradeNo, common.GetJsonString(params), model.PaymentProviderAlipay, params.Get("trade_type")); err != nil {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	_, _ = c.Writer.Write([]byte("success"))
}
