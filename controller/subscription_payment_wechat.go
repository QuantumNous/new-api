package controller

import (
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments"
)

type SubscriptionWechatPayRequest struct {
	PlanId        int    `json:"plan_id"`
	PaymentMethod string `json:"payment_method"`
}

func SubscriptionRequestWechatPay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	if !isWechatTopUpEnabled() {
		common.ApiErrorMsg(c, "微信支付未启用")
		return
	}
	var req SubscriptionWechatPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if req.PaymentMethod == "" {
		req.PaymentMethod = model.PaymentMethodWechatNative
	}
	if req.PaymentMethod != model.PaymentMethodWechatNative && req.PaymentMethod != model.PaymentMethodWechatH5 {
		common.ApiErrorMsg(c, "不支持的微信支付方式")
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
	config, err := getDecryptedPaymentConfig(model.PaymentProviderWechat)
	if err != nil {
		common.ApiErrorMsg(c, "微信支付未配置")
		return
	}
	tradeNo := fmt.Sprintf("SUB-WECHAT-%d-%d-%s", userId, time.Now().UnixMilli(), randstr.String(6))
	order := &model.SubscriptionOrder{UserId: userId, PlanId: plan.Id, Money: plan.PriceAmount, TradeNo: tradeNo, PaymentMethod: req.PaymentMethod, PaymentProvider: model.PaymentProviderWechat, CreateTime: time.Now().Unix(), Status: common.TopUpStatusPending}
	if err := order.Insert(); err != nil {
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}
	client, err := service.NewWechatPayClient(config, "/api/subscription/wechat/notify")
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信订阅支付 SDK初始化失败 trade_no=%s error=%q", tradeNo, err.Error()))
		_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderWechat)
		common.ApiErrorMsg(c, "支付配置错误")
		return
	}
	description := fmt.Sprintf("订阅套餐:%s", plan.Title)
	expireTime := time.Now().Add(30 * time.Minute)
	amountInFen := yuanToFen(plan.PriceAmount)
	ctx := c.Request.Context()
	switch req.PaymentMethod {
	case model.PaymentMethodWechatNative:
		codeURL, err := client.CreateNativeOrder(ctx, tradeNo, description, amountInFen, expireTime)
		if err != nil {
			_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderWechat)
			common.ApiErrorMsg(c, "拉起支付失败")
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"code_url": codeURL, "trade_no": tradeNo}})
	case model.PaymentMethodWechatH5:
		h5URL, err := client.CreateH5Order(ctx, tradeNo, description, amountInFen, expireTime, c.ClientIP())
		if err != nil {
			_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderWechat)
			common.ApiErrorMsg(c, "拉起支付失败")
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"h5_url": h5URL, "trade_no": tradeNo}})
	}
}

func SubscriptionWechatNotify(c *gin.Context) {
	if !isWechatWebhookEnabled() {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "webhook disabled"})
		return
	}
	config, err := getDecryptedPaymentConfig(model.PaymentProviderWechat)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "config not found"})
		return
	}
	client, err := service.NewWechatPayClient(config, "/api/subscription/wechat/notify")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "sdk init failed"})
		return
	}
	transaction := new(payments.Transaction)
	notifyReq, err := client.ParseNotifyRequest(c.Request.Context(), c.Request, transaction)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "verify failed"})
		return
	}
	if transaction.OutTradeNo == nil || transaction.TradeState == nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "invalid notification"})
		return
	}
	tradeNo := *transaction.OutTradeNo
	tradeState := *transaction.TradeState
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信订阅支付 webhook 验签成功 trade_no=%s trade_state=%s summary=%s", tradeNo, tradeState, notifyReq.Summary))
	if tradeState != "SUCCESS" {
		if tradeState == "CLOSED" || tradeState == "PAYERROR" {
			_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderWechat)
		}
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
		return
	}
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if err := model.CompleteSubscriptionOrder(tradeNo, common.GetJsonString(transaction), model.PaymentProviderWechat, tradeState); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "complete failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
}
