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
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/thanhpk/randstr"
)

type AlipayPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

func RequestAlipayPay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	if !isAlipayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付宝支付未启用"})
		return
	}
	var req AlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.PaymentMethod != model.PaymentMethodAlipayPC && req.PaymentMethod != model.PaymentMethodAlipayH5 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的支付宝支付方式"})
		return
	}
	if req.Amount < getMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}
	config, err := getDecryptedPaymentConfig(model.PaymentProviderAlipay)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝支付 获取配置失败 user_id=%d error=%q", id, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付宝支付未配置"})
		return
	}

	tradeNo := fmt.Sprintf("ALIPAY-%d-%d-%s", id, time.Now().UnixMilli(), randstr.String(6))
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = decimal.NewFromInt(amount).Div(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart()
	}
	topUp := &model.TopUp{UserId: id, Amount: amount, Money: payMoney, TradeNo: tradeNo, PaymentMethod: req.PaymentMethod, PaymentProvider: model.PaymentProviderAlipay, CreateTime: time.Now().Unix(), Status: common.TopUpStatusPending}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝支付 创建充值订单失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	returnURL := paymentReturnPath("/console/topup?show_history=true")
	client, err := service.NewAlipayPayClient(config, "/api/alipay/notify", returnURL)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝支付 SDK初始化失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付配置错误"})
		return
	}
	totalAmount := strconv.FormatFloat(payMoney, 'f', 2, 64)
	subject := fmt.Sprintf("账户充值%d", req.Amount)
	expireTime := time.Now().Add(30 * time.Minute).Format("2006-01-02 15:04:05")
	var payURL string
	switch req.PaymentMethod {
	case model.PaymentMethodAlipayPC:
		payURL, err = client.CreatePagePay(tradeNo, subject, totalAmount, expireTime)
	case model.PaymentMethodAlipayH5:
		payURL, err = client.CreateWAPPay(tradeNo, subject, totalAmount, expireTime, returnURL)
	}
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝支付 拉起支付失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"pay_url": payURL, "trade_no": tradeNo}})
}

func AlipayNotify(c *gin.Context) {
	if !isAlipayWebhookEnabled() {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	config, err := getDecryptedPaymentConfig(model.PaymentProviderAlipay)
	if err != nil {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	client, err := service.NewAlipayPayClient(config, "/api/alipay/notify", paymentReturnPath("/console/topup?show_history=true"))
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
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝支付 webhook 验签失败 error=%q", err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	tradeNo := params.Get("out_trade_no")
	tradeStatus := params.Get("trade_status")
	if tradeStatus != "TRADE_SUCCESS" && tradeStatus != "TRADE_FINISHED" {
		if tradeStatus == "TRADE_CLOSED" {
			_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderAlipay, common.TopUpStatusFailed)
		}
		_, _ = c.Writer.Write([]byte("success"))
		return
	}
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if err := model.RechargeAlipay(tradeNo, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝支付 充值处理失败 trade_no=%s error=%q", tradeNo, err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	_, _ = c.Writer.Write([]byte("success"))
}

func RequestAlipayAmount(c *gin.Context) {
	var req AlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < getMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
		return
	}
	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}
