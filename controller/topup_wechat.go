package controller

import (
	"fmt"
	"net/http"
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
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments"
)

type WechatPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

func RequestWechatPay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	if !isWechatTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "微信支付未启用"})
		return
	}
	var req WechatPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.PaymentMethod != model.PaymentMethodWechatNative && req.PaymentMethod != model.PaymentMethodWechatH5 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的微信支付方式"})
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
	config, err := getDecryptedPaymentConfig(model.PaymentProviderWechat)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 获取配置失败 user_id=%d error=%q", id, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "微信支付未配置"})
		return
	}
	tradeNo := fmt.Sprintf("WECHAT-%d-%d-%s", id, time.Now().UnixMilli(), randstr.String(6))
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = decimal.NewFromInt(amount).Div(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart()
	}
	topUp := &model.TopUp{UserId: id, Amount: amount, Money: payMoney, TradeNo: tradeNo, PaymentMethod: req.PaymentMethod, PaymentProvider: model.PaymentProviderWechat, CreateTime: time.Now().Unix(), Status: common.TopUpStatusPending}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 创建充值订单失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	client, err := service.NewWechatPayClient(config, "/api/wechat/notify")
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 SDK初始化失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付配置错误"})
		return
	}
	description := fmt.Sprintf("账户充值%d", req.Amount)
	expireTime := time.Now().Add(30 * time.Minute)
	amountInFen := yuanToFen(payMoney)
	ctx := c.Request.Context()
	switch req.PaymentMethod {
	case model.PaymentMethodWechatNative:
		codeURL, err := client.CreateNativeOrder(ctx, tradeNo, description, amountInFen, expireTime)
		if err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 拉起Native支付失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
			topUp.Status = common.TopUpStatusFailed
			_ = topUp.Update()
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"code_url": codeURL, "trade_no": tradeNo}})
	case model.PaymentMethodWechatH5:
		h5URL, err := client.CreateH5Order(ctx, tradeNo, description, amountInFen, expireTime, c.ClientIP())
		if err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 拉起H5支付失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
			topUp.Status = common.TopUpStatusFailed
			_ = topUp.Update()
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"h5_url": h5URL, "trade_no": tradeNo}})
	}
}

func WechatNotify(c *gin.Context) {
	if !isWechatWebhookEnabled() {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "webhook disabled"})
		return
	}
	config, err := getDecryptedPaymentConfig(model.PaymentProviderWechat)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "config not found"})
		return
	}
	client, err := service.NewWechatPayClient(config, "/api/wechat/notify")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "sdk init failed"})
		return
	}
	transaction := new(payments.Transaction)
	notifyReq, err := client.ParseNotifyRequest(c.Request.Context(), c.Request, transaction)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 webhook 验签失败 error=%q", err.Error()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "verify failed"})
		return
	}
	if transaction.OutTradeNo == nil || transaction.TradeState == nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "invalid notification"})
		return
	}
	tradeNo := *transaction.OutTradeNo
	tradeState := *transaction.TradeState
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付 webhook 验签成功 trade_no=%s trade_state=%s summary=%s", tradeNo, tradeState, notifyReq.Summary))
	if tradeState != "SUCCESS" {
		if tradeState == "CLOSED" || tradeState == "PAYERROR" {
			_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderWechat, common.TopUpStatusFailed)
		}
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
		return
	}
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if err := model.RechargeWechat(tradeNo, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 充值处理失败 trade_no=%s error=%q", tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "recharge failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
}

func RequestWechatAmount(c *gin.Context) {
	var req WechatPayRequest
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
