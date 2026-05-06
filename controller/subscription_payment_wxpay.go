package controller

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/wechatpay-apiv3/wechatpay-go/core"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments/native"
)

// SubscriptionWxpayPayRequest holds the plan ID for a WeChat Pay subscription purchase.
type SubscriptionWxpayPayRequest struct {
	PlanId int `json:"plan_id"`
}

// SubscriptionWxpayPayResponse is returned after successfully creating a subscription order.
type SubscriptionWxpayPayResponse struct {
	QRCode  string `json:"qr_code"`
	TradeNo string `json:"trade_no"`
}

// SubscriptionRequestWxpay POST /api/subscription/wxpay/pay
func SubscriptionRequestWxpay(c *gin.Context) {
	if !isWxpayEnabled() {
		common.ApiErrorMsg(c, "微信支付未配置")
		return
	}

	var req SubscriptionWxpayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
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
	if !strings.EqualFold(plan.Currency, "CNY") {
		common.ApiErrorMsg(c, "该套餐不支持微信支付直连（仅支持 CNY 套餐）")
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

	clients, err := getWxpayClient()
	if err != nil {
		logger.LogError(c.Request.Context(), "wxpay subscription client init: "+err.Error())
		common.ApiErrorMsg(c, "微信支付服务初始化失败")
		return
	}

	tradeNo := fmt.Sprintf("SUBWXUSR%dNO%s%d", userId, common.GetRandomString(6), time.Now().Unix())
	notifyURL := service.GetCallbackAddress() + "/api/subscription/wxpay/notify"

	totalFen := int64(plan.PriceAmount * 100)
	if totalFen <= 0 {
		common.ApiErrorMsg(c, "套餐金额无效")
		return
	}

	order := &model.SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodWxpay,
		PaymentProvider: model.PaymentProviderWxpayDirect,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("wxpay subscription insert order failed user=%d err=%v", userId, err))
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	cur := "CNY"
	svc := native.NativeApiService{Client: clients.client}
	resp, _, err := svc.Prepay(c.Request.Context(), native.PrepayRequest{
		Appid:       core.String(setting.WxpayAppId),
		Mchid:       core.String(setting.WxpayMchId),
		Description: core.String(fmt.Sprintf("SUB:%s", plan.Title)),
		OutTradeNo:  core.String(tradeNo),
		NotifyUrl:   core.String(notifyURL),
		Amount:      &native.Amount{Total: core.Int64(totalFen), Currency: &cur},
	})
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("wxpay subscription prepay failed user=%d trade=%s err=%v", userId, tradeNo, err))
		_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderWxpayDirect)
		common.ApiErrorMsg(c, "拉起微信支付失败")
		return
	}

	codeURL := ""
	if resp.CodeUrl != nil {
		codeURL = *resp.CodeUrl
	}
	if codeURL == "" {
		_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderWxpayDirect)
		common.ApiErrorMsg(c, "微信支付返回二维码为空")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": SubscriptionWxpayPayResponse{
			QRCode:  codeURL,
			TradeNo: tradeNo,
		},
	})
}

// SubscriptionWxpayNotify POST /api/subscription/wxpay/notify
func SubscriptionWxpayNotify(c *gin.Context) {
	clients, err := getWxpayClient()
	if err != nil {
		logger.LogError(c.Request.Context(), "wxpay subscription notify: client not ready: "+err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "server error"})
		return
	}

	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "read body error"})
		return
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, "/", io.NopCloser(bytes.NewReader(rawBody)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "build request error"})
		return
	}
	for k, vals := range c.Request.Header {
		for _, v := range vals {
			req.Header.Add(k, v)
		}
	}

	var tx payments.Transaction
	nr, err := clients.handler.ParseNotifyRequest(c.Request.Context(), req, &tx)
	if err != nil {
		logger.LogError(c.Request.Context(), "wxpay subscription notify parse: "+err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "verify error"})
		return
	}
	if nr.EventType != "TRANSACTION.SUCCESS" {
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "ok"})
		return
	}

	tradeState := ""
	if tx.TradeState != nil {
		tradeState = *tx.TradeState
	}
	if tradeState != "SUCCESS" {
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "ok"})
		return
	}

	tradeNo := ""
	if tx.OutTradeNo != nil {
		tradeNo = *tx.OutTradeNo
	}
	if tradeNo == "" {
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "ok"})
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	if err := model.CompleteSubscriptionOrder(
		tradeNo,
		common.GetJsonString(tx),
		model.PaymentProviderWxpayDirect,
		model.PaymentMethodWxpay,
	); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("wxpay subscription complete order failed trade=%s err=%v", tradeNo, err))
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "recharge error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "ok"})
}

// SubscriptionQueryWxpayOrder GET /api/subscription/wxpay/query?trade_no=xxx
func SubscriptionQueryWxpayOrder(c *gin.Context) {
	tradeNo := strings.TrimSpace(c.Query("trade_no"))
	if tradeNo == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "缺少 trade_no"})
		return
	}

	order := model.GetSubscriptionOrderByTradeNo(tradeNo)
	if order == nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "订单不存在"})
		return
	}
	if order.UserId != c.GetInt("id") {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "无权访问"})
		return
	}

	if order.Status == common.TopUpStatusSuccess || order.Status == common.TopUpStatusFailed || order.Status == common.TopUpStatusExpired {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": order.Status, "plan_id": order.PlanId})
		return
	}

	clients, err := getWxpayClient()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": order.Status, "plan_id": order.PlanId})
		return
	}

	svc := native.NativeApiService{Client: clients.client}
	tx, _, err := svc.QueryOrderByOutTradeNo(c.Request.Context(), native.QueryOrderByOutTradeNoRequest{
		OutTradeNo: core.String(tradeNo),
		Mchid:      core.String(setting.WxpayMchId),
	})
	if err == nil && tx.TradeState != nil && *tx.TradeState == "SUCCESS" {
		LockOrder(tradeNo)
		_ = model.CompleteSubscriptionOrder(
			tradeNo,
			common.GetJsonString(tx),
			model.PaymentProviderWxpayDirect,
			model.PaymentMethodWxpay,
		)
		UnlockOrder(tradeNo)
		order = model.GetSubscriptionOrderByTradeNo(tradeNo)
	}

	status := common.TopUpStatusPending
	planId := 0
	if order != nil {
		status = order.Status
		planId = order.PlanId
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": status, "plan_id": planId})
}

// CloseExpiredSubscriptionWxpayOrders is called by cron to expire stale pending subscription orders.
func CloseExpiredSubscriptionWxpayOrders() {
	if !isWxpayEnabled() {
		return
	}
	clients, err := getWxpayClient()
	if err != nil {
		common.SysError("wxpay subscription close expired: client not ready: " + err.Error())
		return
	}

	cutoff := time.Now().Add(-15 * time.Minute).Unix()
	var orders []model.SubscriptionOrder
	model.DB.Where("payment_provider = ? AND status = ? AND create_time < ?",
		model.PaymentProviderWxpayDirect, common.TopUpStatusPending, cutoff).Find(&orders)

	svc := native.NativeApiService{Client: clients.client}
	for _, order := range orders {
		_, err := svc.CloseOrder(context.Background(), native.CloseOrderRequest{
			OutTradeNo: core.String(order.TradeNo),
			Mchid:      core.String(setting.WxpayMchId),
		})
		if err != nil {
			common.SysError(fmt.Sprintf("wxpay subscription close order %s: %v", order.TradeNo, err))
			continue
		}
		_ = model.ExpireSubscriptionOrder(order.TradeNo, model.PaymentProviderWxpayDirect)
	}
}
