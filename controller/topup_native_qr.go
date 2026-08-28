package controller

import (
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// topup_native_qr.go 处理微信/支付宝原生扫码充值：
//   - RequestNativePay 创建 pending 订单并向支付渠道下单，返回 code_url 供前端渲染二维码
//   - QueryNativeOrder  前端轮询端点，主动查询渠道并在支付成功时结算（回调未到也能到账）
//   - WechatNativeNotify / AlipayNativeNotify 异步回调，验签后结算
//
// 三条路径最终都通过 creditNativeOrder -> model.RechargeNativeQR 完成幂等结算。

type NativePayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

// nativeEnabledProvider 返回该支付方式对应且已启用的渠道常量，未启用则返回空串。
func nativeEnabledProvider(paymentMethod string) string {
	switch paymentMethod {
	case model.PaymentMethodWechatNative:
		if isWechatNativeTopUpEnabled() {
			return model.PaymentProviderWechatNative
		}
	case model.PaymentMethodAlipayNative:
		if isAlipayNativeTopUpEnabled() {
			return model.PaymentProviderAlipayNative
		}
	}
	return ""
}

// creditNativeOrder 结算一笔原生扫码订单（进程内订单锁 + 数据库行锁保证幂等）。
func creditNativeOrder(c *gin.Context, tradeNo string, provider string) error {
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	_, err := model.RechargeNativeQR(tradeNo, provider, c.ClientIP())
	return err
}

func RequestNativePay(c *gin.Context) {
	var req NativePayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	provider := nativeEnabledProvider(req.PaymentMethod)
	if provider == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付方式不存在或未启用"})
		return
	}

	if req.Amount < getMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
		return
	}
	id := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}

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

	// 订单金额（额度换算口径与易支付一致：TOKENS 展示时换算为充值单位数量）
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = decimal.NewFromInt(amount).Div(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart()
	}

	tradeNo := fmt.Sprintf("USR%dNO%s%d", id, common.GetRandomString(6), time.Now().Unix())

	// 先落库 pending 订单，确保快速到达的回调/轮询能命中订单
	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   req.PaymentMethod,
		PaymentProvider: provider,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("原生扫码 创建充值订单失败 user_id=%d trade_no=%s provider=%s error=%q", id, tradeNo, provider, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	notifyPath := "/api/wechat-native/notify"
	if provider == model.PaymentProviderAlipayNative {
		notifyPath = "/api/alipay-native/notify"
	}
	notifyURL := service.GetCallbackAddress() + notifyPath
	subject := fmt.Sprintf("%s-%d", common.SystemName, req.Amount)

	codeURL, err := service.NativePrecreate(c.Request.Context(), provider, tradeNo, subject, payMoney, notifyURL)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("原生扫码 拉起支付失败 user_id=%d trade_no=%s provider=%s amount=%d error=%q", id, tradeNo, provider, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("原生扫码 充值订单创建成功 user_id=%d trade_no=%s provider=%s amount=%d money=%.2f", id, tradeNo, provider, req.Amount, payMoney))
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{
		"code_url": codeURL,
		"trade_no": tradeNo,
	}})
}

func QueryNativeOrder(c *gin.Context) {
	tradeNo := c.Query("trade_no")
	if tradeNo == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "缺少订单号"})
		return
	}
	id := c.GetInt("id")
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.UserId != id {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "订单不存在"})
		return
	}
	if topUp.PaymentProvider != model.PaymentProviderWechatNative && topUp.PaymentProvider != model.PaymentProviderAlipayNative {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "订单类型错误"})
		return
	}

	// 已结算或非待支付：直接回报当前状态
	if topUp.Status != common.TopUpStatusPending {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": topUp.Status}})
		return
	}

	// 主动向支付渠道查询，回调未到达也能及时到账
	paid, err := service.NativeQuery(c.Request.Context(), topUp.PaymentProvider, tradeNo)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("原生扫码 查询订单失败 trade_no=%s provider=%s error=%q", tradeNo, topUp.PaymentProvider, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": common.TopUpStatusPending}})
		return
	}
	if !paid {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": common.TopUpStatusPending}})
		return
	}

	if err := creditNativeOrder(c, tradeNo, topUp.PaymentProvider); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("原生扫码 结算失败 trade_no=%s provider=%s error=%q", tradeNo, topUp.PaymentProvider, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值失败，请稍后重试"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": common.TopUpStatusSuccess}})
}

func WechatNativeNotify(c *gin.Context) {
	if !isWechatNativeWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信原生 webhook 被拒绝 reason=disabled client_ip=%s", c.ClientIP()))
		c.JSON(http.StatusForbidden, gin.H{"code": "FAIL", "message": "webhook disabled"})
		return
	}
	tradeNo, paid, err := service.VerifyWechatNotify(c.Request)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信原生 webhook 验签/解密失败 client_ip=%s error=%q", c.ClientIP(), err.Error()))
		c.JSON(http.StatusUnauthorized, gin.H{"code": "FAIL", "message": "verify failed"})
		return
	}
	if !paid {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信原生 webhook 忽略非成功事件 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
		return
	}
	if err := creditNativeOrder(c, tradeNo, model.PaymentProviderWechatNative); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信原生 webhook 结算失败 trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "settle failed"})
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信原生 webhook 结算成功 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
	c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
}

func AlipayNativeNotify(c *gin.Context) {
	if !isAlipayNativeWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝原生 webhook 被拒绝 reason=disabled client_ip=%s", c.ClientIP()))
		_, _ = c.Writer.WriteString("failure")
		return
	}
	tradeNo, paid, err := service.VerifyAlipayNotify(c.Request)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝原生 webhook 验签失败 client_ip=%s error=%q", c.ClientIP(), err.Error()))
		_, _ = c.Writer.WriteString("failure")
		return
	}
	if !paid {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝原生 webhook 忽略非成功事件 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		_, _ = c.Writer.WriteString("success")
		return
	}
	if err := creditNativeOrder(c, tradeNo, model.PaymentProviderAlipayNative); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝原生 webhook 结算失败 trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
		_, _ = c.Writer.WriteString("failure")
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝原生 webhook 结算成功 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
	_, _ = c.Writer.WriteString("success")
}
