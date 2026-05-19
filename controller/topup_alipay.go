package controller

import (
	"context"
	"errors"
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
	"github.com/gin-gonic/gin"
	"github.com/go-pay/gopay"
	alipaynotify "github.com/go-pay/gopay/alipay"
	alipayv3 "github.com/go-pay/gopay/alipay/v3"
	"github.com/shopspring/decimal"
)

type AlipayPayRequest struct {
	Amount int64 `json:"amount"`
}

func RequestAlipayPay(c *gin.Context) {
	var req AlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	minTopUp := int64(setting.AlipayMinTopUp)
	if minTopUp <= 0 {
		minTopUp = getMinTopup()
	}
	if req.Amount < minTopUp {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", minTopUp)})
		return
	}
	if !isAlipayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "当前管理员未配置支付宝支付信息"})
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

	tradeNo := fmt.Sprintf("ALP%dNO%s%d", id, common.GetRandomString(6), time.Now().Unix())
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}
	topUp := &model.TopUp{
		UserId:        id,
		Amount:        amount,
		Money:         payMoney,
		TradeNo:       tradeNo,
		PaymentMethod: model.PaymentMethodAlipayDirect,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	qrCode, err := createAlipayTradePrecreate(c.Request.Context(), tradeNo, req.Amount, payMoney)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝拉起支付失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentMethodAlipayDirect, common.TopUpStatusFailed)
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"qr_code": qrCode, "trade_no": tradeNo}})
}

func newAlipayClient() (*alipayv3.ClientV3, error) {
	client, err := alipayv3.NewClientV3(setting.AlipayAppId, setting.AlipayPrivateKey, !setting.AlipaySandbox)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(setting.AlipayAppCertPublicKey) != "" || strings.TrimSpace(setting.AlipayRootCert) != "" || strings.TrimSpace(setting.AlipayPublicCert) != "" {
		if strings.TrimSpace(setting.AlipayAppCertPublicKey) == "" || strings.TrimSpace(setting.AlipayRootCert) == "" || strings.TrimSpace(setting.AlipayPublicCert) == "" {
			return nil, errors.New("支付宝证书配置不完整")
		}
		if err := client.SetCert([]byte(setting.AlipayAppCertPublicKey), []byte(setting.AlipayRootCert), []byte(setting.AlipayPublicCert)); err != nil {
			return nil, err
		}
	}
	return client, nil
}

func createAlipayTradePrecreate(ctx context.Context, tradeNo string, amount int64, payMoney float64) (string, error) {
	client, err := newAlipayClient()
	if err != nil {
		return "", err
	}

	notifyURL := service.GetCallbackAddress() + "/api/user/direct-pay/alipay/notify"
	bm := make(gopay.BodyMap)
	bm.Set("subject", fmt.Sprintf("TUC%d", amount)).
		Set("out_trade_no", tradeNo).
		Set("total_amount", strconv.FormatFloat(payMoney, 'f', 2, 64)).
		Set("notify_url", notifyURL)
	rsp, err := client.TradePrecreate(ctx, bm)
	if err != nil {
		return "", err
	}
	if rsp.StatusCode != alipayv3.Success {
		if rsp.ErrResponse.Message != "" {
			return "", errors.New(rsp.ErrResponse.Message)
		}
		return "", fmt.Errorf("alipay status %d", rsp.StatusCode)
	}
	if rsp.QrCode == "" {
		return "", errors.New("支付宝未返回二维码链接")
	}
	return rsp.QrCode, nil
}

func AlipayNotify(c *gin.Context) {
	if !isAlipayWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	bm, err := alipaynotify.ParseNotifyToBodyMap(c.Request)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 解析失败 client_ip=%s error=%q", c.ClientIP(), err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	tradeNo := bm.GetString("out_trade_no")
	tradeStatus := bm.GetString("trade_status")
	totalAmount := bm.GetString("total_amount")
	appID := bm.GetString("app_id")

	if appID != "" && appID != setting.AlipayAppId {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook app_id 不匹配 trade_no=%s app_id=%s client_ip=%s", tradeNo, appID, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	ok, err := verifyAlipayNotify(bm)
	if err != nil || !ok {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 验签失败 trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), errorString(err)))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	_, _ = c.Writer.Write([]byte("success"))
	if tradeStatus != "TRADE_SUCCESS" && tradeStatus != "TRADE_FINISHED" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝 webhook 忽略事件 trade_no=%s trade_status=%s client_ip=%s", tradeNo, tradeStatus, c.ClientIP()))
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if err := model.RechargeAlipayDirect(tradeNo, totalAmount, c.ClientIP()); err != nil {
		if strings.Contains(err.Error(), "状态错误") {
			return
		}
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝充值失败 trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
		return
	}
	service.EmitPromotionTopupSucceeded(model.GetTopUpByTradeNo(tradeNo), "CNY")
}

func verifyAlipayNotify(bm gopay.BodyMap) (bool, error) {
	if strings.TrimSpace(setting.AlipayPublicCert) != "" {
		return alipaynotify.VerifySignWithCert([]byte(setting.AlipayPublicCert), bm)
	}
	return alipaynotify.VerifySign(setting.AlipayPublicKey, bm)
}

func errorString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
