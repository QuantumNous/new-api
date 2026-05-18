package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	alipay "github.com/smartwalle/alipay/v3"
)

func getAlipayClient() (*alipay.Client, error) {
	client, err := alipay.New(setting.AlipayAppId, setting.AlipayPrivateKey, !setting.AlipaySandbox)
	if err != nil {
		return nil, err
	}
	if err = client.LoadAliPayPublicKey(setting.AlipayPublicKey); err != nil {
		return nil, err
	}
	return client, nil
}

func getAlipayNotifyUrl() string {
	if strings.TrimSpace(setting.AlipayNotifyUrl) != "" {
		return strings.TrimSpace(setting.AlipayNotifyUrl)
	}
	return service.GetCallbackAddress() + "/api/user/alipay/notify"
}

func getAlipayReturnUrl() string {
	if strings.TrimSpace(setting.AlipayReturnUrl) != "" {
		return strings.TrimSpace(setting.AlipayReturnUrl)
	}
	return system_setting.ServerAddress + "/console/topup?show_history=true"
}

func requestAlipayPagePay(c *gin.Context, req *EpayRequest, userId int, payMoney float64) {
	client, err := getAlipayClient()
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 client 初始化失败 user_id=%d amount=%d error=%q", userId, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "当前管理员未配置支付宝支付信息"})
		return
	}

	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("USR%dNO%s", userId, tradeNo)

	payload := alipay.NewPayload("alipay.trade.page.pay")
	payload.AddParam("notify_url", getAlipayNotifyUrl())
	payload.AddParam("return_url", getAlipayReturnUrl())
	payload.AddBizField("out_trade_no", tradeNo)
	payload.AddBizField("subject", fmt.Sprintf("TUC%d", req.Amount))
	payload.AddBizField("total_amount", strconv.FormatFloat(payMoney, 'f', 2, 64))
	payload.AddBizField("product_code", "FAST_INSTANT_TRADE_PAY")

	payUrl, err := client.BuildURL(payload)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 拉起支付失败 user_id=%d trade_no=%s amount=%d error=%q", userId, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}

	topUp := &model.TopUp{
		UserId:          userId,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipay,
		PaymentProvider: model.PaymentProviderAlipay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err = topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", userId, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f pay_url=%q", userId, tradeNo, req.Amount, payMoney, payUrl.String()))
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{}, "url": payUrl.String(), "method": http.MethodGet})
}

func AlipayNotify(c *gin.Context) {
	if !isAlipayConfigured() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if err := c.Request.ParseForm(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 webhook 表单解析失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	client, err := getAlipayClient()
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 client 未初始化 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if err = client.VerifySign(c.Request.Form); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 验签失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	alipay.ACKNotification(c.Writer)

	tradeNo := c.Request.Form.Get("out_trade_no")
	tradeStatus := c.Request.Form.Get("trade_status")
	appId := c.Request.Form.Get("app_id")
	totalAmount := c.Request.Form.Get("total_amount")

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝 webhook 验签成功 trade_no=%s trade_status=%s client_ip=%s params=%q", tradeNo, tradeStatus, c.ClientIP(), common.GetJsonString(c.Request.Form)))

	if appId != setting.AlipayAppId {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook app_id 不匹配 trade_no=%s callback_app_id=%s local_app_id=%s client_ip=%s", tradeNo, appId, setting.AlipayAppId, c.ClientIP()))
		return
	}

	if tradeStatus != "TRADE_SUCCESS" && tradeStatus != "TRADE_FINISHED" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝 webhook 忽略事件 trade_no=%s trade_status=%s client_ip=%s", tradeNo, tradeStatus, c.ClientIP()))
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 回调订单不存在 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		return
	}
	if topUp.PaymentProvider != model.PaymentProviderAlipay {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 订单支付网关不匹配 trade_no=%s order_provider=%s client_ip=%s", tradeNo, topUp.PaymentProvider, c.ClientIP()))
		return
	}
	if topUp.Status != common.TopUpStatusPending {
		return
	}

	expectedAmount := strconv.FormatFloat(topUp.Money, 'f', 2, 64)
	if totalAmount != expectedAmount {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 回调金额不匹配 trade_no=%s callback_total_amount=%s expected_total_amount=%s client_ip=%s", tradeNo, totalAmount, expectedAmount, c.ClientIP()))
		return
	}

	topUp.Status = common.TopUpStatusSuccess
	if err = topUp.Update(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 更新充值订单失败 trade_no=%s user_id=%d client_ip=%s error=%q topup=%q", topUp.TradeNo, topUp.UserId, c.ClientIP(), err.Error(), common.GetJsonString(topUp)))
		return
	}

	dAmount := decimal.NewFromInt(int64(topUp.Amount))
	dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	quotaToAdd := int(dAmount.Mul(dQuotaPerUnit).IntPart())
	if err = model.IncreaseUserQuota(topUp.UserId, quotaToAdd, true); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 更新用户额度失败 trade_no=%s user_id=%d client_ip=%s quota_to_add=%d error=%q topup=%q", topUp.TradeNo, topUp.UserId, c.ClientIP(), quotaToAdd, err.Error(), common.GetJsonString(topUp)))
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝 充值成功 trade_no=%s user_id=%d client_ip=%s quota_to_add=%d money=%.2f topup=%q", topUp.TradeNo, topUp.UserId, c.ClientIP(), quotaToAdd, topUp.Money, common.GetJsonString(topUp)))
	model.RecordTopupLog(topUp.UserId, fmt.Sprintf("使用支付宝充值成功，充值金额: %v，支付金额：%f", logger.LogQuota(quotaToAdd), topUp.Money), c.ClientIP(), topUp.PaymentMethod, model.PaymentProviderAlipay)
}
