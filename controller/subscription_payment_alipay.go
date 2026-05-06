package controller

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/smartwalle/alipay/v3"
)

// SubscriptionAlipayPayRequest holds the plan ID for an Alipay subscription purchase.
type SubscriptionAlipayPayRequest struct {
	PlanId int `json:"plan_id"`
}

// SubscriptionAlipayPayResponse is returned after successfully creating a subscription order.
type SubscriptionAlipayPayResponse struct {
	QRCode  string `json:"qr_code,omitempty"`
	PayURL  string `json:"pay_url,omitempty"`
	TradeNo string `json:"trade_no"`
}

// SubscriptionRequestAlipay POST /api/subscription/alipay/pay
func SubscriptionRequestAlipay(c *gin.Context) {
	if !isAlipayEnabled() {
		common.ApiErrorMsg(c, "支付宝直连未配置")
		return
	}

	var req SubscriptionAlipayPayRequest
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
		common.ApiErrorMsg(c, "该套餐不支持支付宝直连支付（仅支持 CNY 套餐）")
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

	client, err := getAlipayClient()
	if err != nil {
		logger.LogError(c.Request.Context(), "alipay subscription client init: "+err.Error())
		common.ApiErrorMsg(c, "支付宝服务初始化失败")
		return
	}

	tradeNo := fmt.Sprintf("SUBALIUSR%dNO%s%d", userId, common.GetRandomString(6), time.Now().Unix())
	callbackBase := service.GetCallbackAddress()
	notifyURL := callbackBase + "/api/subscription/alipay/notify"
	returnURL := callbackBase + "/console/subscription?pay=processing"
	moneyStr := fmt.Sprintf("%.2f", plan.PriceAmount)
	subject := fmt.Sprintf("SUB:%s", plan.Title)

	order := &model.SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipay,
		PaymentProvider: model.PaymentProviderAlipayDirect,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("alipay subscription insert order failed user=%d err=%v", userId, err))
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	var qrCode, payURL string
	preParam := alipay.TradePreCreate{}
	preParam.OutTradeNo = tradeNo
	preParam.TotalAmount = moneyStr
	preParam.Subject = subject
	preParam.ProductCode = "FACE_TO_FACE_PAYMENT"
	preParam.NotifyURL = notifyURL
	preRsp, preErr := client.TradePreCreate(c.Request.Context(), preParam)
	if preErr == nil && !preRsp.IsFailure() && strings.TrimSpace(preRsp.QRCode) != "" {
		qrCode = preRsp.QRCode
	} else {
		pageParam := alipay.TradePagePay{}
		pageParam.OutTradeNo = tradeNo
		pageParam.TotalAmount = moneyStr
		pageParam.Subject = subject
		pageParam.ProductCode = "FAST_INSTANT_TRADE_PAY"
		pageParam.NotifyURL = notifyURL
		pageParam.ReturnURL = returnURL
		pageURL, pageErr := client.TradePagePay(pageParam)
		if pageErr != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("alipay subscription create order failed user=%d trade=%s err=%v", userId, tradeNo, pageErr))
			_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderAlipayDirect)
			common.ApiErrorMsg(c, "拉起支付宝失败")
			return
		}
		payURL = pageURL.String()
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": SubscriptionAlipayPayResponse{
			QRCode:  qrCode,
			PayURL:  payURL,
			TradeNo: tradeNo,
		},
	})
}

// SubscriptionAlipayNotify POST/GET /api/subscription/alipay/notify
func SubscriptionAlipayNotify(c *gin.Context) {
	client, err := getAlipayClient()
	if err != nil {
		logger.LogError(c.Request.Context(), "alipay subscription notify: client not ready: "+err.Error())
		c.String(http.StatusOK, "fail")
		return
	}

	if err := c.Request.ParseForm(); err != nil {
		c.String(http.StatusOK, "fail")
		return
	}

	notification, err := client.DecodeNotification(c.Request.Context(), c.Request.Form)
	if err != nil {
		logger.LogError(c.Request.Context(), "alipay subscription notify decode: "+err.Error())
		c.String(http.StatusOK, "fail")
		return
	}

	if notification.TradeStatus != alipay.TradeStatusSuccess && notification.TradeStatus != alipay.TradeStatusFinished {
		c.String(http.StatusOK, "success")
		return
	}

	tradeNo := notification.OutTradeNo
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	if err := model.CompleteSubscriptionOrder(
		tradeNo,
		common.GetJsonString(notification),
		model.PaymentProviderAlipayDirect,
		model.PaymentMethodAlipay,
	); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("alipay subscription complete order failed trade=%s err=%v", tradeNo, err))
		c.String(http.StatusOK, "fail")
		return
	}
	c.String(http.StatusOK, "success")
}

// SubscriptionQueryAlipayOrder GET /api/subscription/alipay/query?trade_no=xxx
func SubscriptionQueryAlipayOrder(c *gin.Context) {
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

	client, err := getAlipayClient()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": order.Status, "plan_id": order.PlanId})
		return
	}

	queryParam := alipay.TradeQuery{}
	queryParam.OutTradeNo = tradeNo
	result, err := client.TradeQuery(c.Request.Context(), queryParam)
	if err == nil && !result.IsFailure() &&
		(result.TradeStatus == alipay.TradeStatusSuccess || result.TradeStatus == alipay.TradeStatusFinished) {
		LockOrder(tradeNo)
		_ = model.CompleteSubscriptionOrder(
			tradeNo,
			common.GetJsonString(result),
			model.PaymentProviderAlipayDirect,
			model.PaymentMethodAlipay,
		)
		UnlockOrder(tradeNo)
		order = model.GetSubscriptionOrderByTradeNo(tradeNo)
	}

	status := common.TopUpStatusPending
	planId := req2PlanId(order)
	if order != nil {
		status = order.Status
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": status, "plan_id": planId})
}

// CloseExpiredSubscriptionAlipayOrders is called by cron to expire stale pending subscription orders.
func CloseExpiredSubscriptionAlipayOrders() {
	if !isAlipayEnabled() {
		return
	}
	client, err := getAlipayClient()
	if err != nil {
		common.SysError("alipay subscription close expired: client not ready: " + err.Error())
		return
	}

	cutoff := time.Now().Add(-15 * time.Minute).Unix()
	var orders []model.SubscriptionOrder
	model.DB.Where("payment_provider = ? AND status = ? AND create_time < ?",
		model.PaymentProviderAlipayDirect, common.TopUpStatusPending, cutoff).Find(&orders)

	closed := 0
	for _, order := range orders {
		closeParam := alipay.TradeClose{}
		closeParam.OutTradeNo = order.TradeNo
		_, err := client.TradeClose(context.Background(), closeParam)
		if err != nil &&
			!strings.Contains(err.Error(), "ACQ.TRADE_NOT_EXIST") &&
			!strings.Contains(err.Error(), "ACQ.TRADE_HAS_CLOSE") {
			common.SysError(fmt.Sprintf("alipay subscription close order %s: %v", order.TradeNo, err))
			continue
		}
		_ = model.ExpireSubscriptionOrder(order.TradeNo, model.PaymentProviderAlipayDirect)
		closed++
	}
	if len(orders) > 0 {
		common.SysLog(fmt.Sprintf("alipay subscription close expired: scanned=%d, closed=%d", len(orders), closed))
	}
}

func req2PlanId(order *model.SubscriptionOrder) int {
	if order == nil {
		return 0
	}
	return order.PlanId
}
