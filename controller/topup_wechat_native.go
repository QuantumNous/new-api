package controller

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
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
	wechat "github.com/go-pay/gopay/wechat/v3"
	"github.com/shopspring/decimal"
)

type WechatNativePayRequest struct {
	Amount int64 `json:"amount"`
}

func RequestWechatNativePay(c *gin.Context) {
	var req WechatNativePayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	minTopUp := int64(setting.WechatNativeMinTopUp)
	if minTopUp <= 0 {
		minTopUp = getMinTopup()
	}
	if req.Amount < minTopUp {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", minTopUp)})
		return
	}
	if !isWechatNativeTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "当前管理员未配置微信支付信息"})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	moneyCents := decimal.NewFromFloat(payMoney).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
	if moneyCents < 1 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	tradeNo := fmt.Sprintf("WCN%dNO%s%d", id, common.GetRandomString(6), time.Now().Unix())
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
		PaymentMethod: model.PaymentMethodDirectWechat,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 Native 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	codeURL, err := createWechatNativeTransaction(c.Request.Context(), tradeNo, req.Amount, moneyCents)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 Native 拉起支付失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentMethodDirectWechat, common.TopUpStatusFailed)
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"code_url": codeURL, "trade_no": tradeNo}})
}

func createWechatNativeTransaction(ctx context.Context, tradeNo string, amount int64, moneyCents int64) (string, error) {
	client, err := newWechatPayClient()
	if err != nil {
		return "", err
	}

	notifyURL := service.GetCallbackAddress() + "/api/user/direct-pay/wechat-native/notify"
	bm := make(gopay.BodyMap)
	bm.Set("appid", setting.WechatNativeAppId).
		Set("mchid", setting.WechatNativeMchId).
		Set("description", fmt.Sprintf("TUC%d", amount)).
		Set("out_trade_no", tradeNo).
		Set("notify_url", notifyURL).
		SetBodyMap("amount", func(amountMap gopay.BodyMap) {
			amountMap.Set("total", moneyCents).
				Set("currency", "CNY")
		})

	response, err := client.V3TransactionNative(ctx, bm)
	if err != nil {
		return "", err
	}
	if response.Code != wechat.Success {
		if response.ErrResponse.Message != "" {
			return "", errors.New(response.ErrResponse.Message)
		}
		if response.Error != "" {
			return "", errors.New(response.Error)
		}
		return "", fmt.Errorf("wechat pay status %d", response.Code)
	}
	if response.Response == nil || response.Response.CodeUrl == "" {
		return "", errors.New("微信支付未返回二维码链接")
	}
	return response.Response.CodeUrl, nil
}

func newWechatPayClient() (*wechat.ClientV3, error) {
	return wechat.NewClientV3(
		setting.WechatNativeMchId,
		setting.WechatNativeMerchantSerialNo,
		setting.WechatNativeApiV3Key,
		setting.WechatNativeMerchantPrivateKey,
	)
}

func WechatNativeNotify(c *gin.Context) {
	if !isWechatNativeWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 Native webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "webhook disabled"})
		return
	}

	notify, err := wechat.V3ParseNotify(c.Request)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 Native webhook 解析失败 client_ip=%s error=%q", c.ClientIP(), err.Error()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "invalid payload"})
		return
	}
	if err := verifyWechatPayNotifySignature(notify); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 Native webhook 验签失败 path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "signature verify failed"})
		return
	}

	transaction, err := notify.DecryptPayCipherText(setting.WechatNativeApiV3Key)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 Native webhook 解密失败 client_ip=%s error=%q", c.ClientIP(), err.Error()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "decrypt failed"})
		return
	}
	if transaction == nil || transaction.Amount == nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "invalid transaction"})
		return
	}
	if transaction.TradeState != wechat.TradeStateSuccess {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付 Native webhook 忽略事件 trade_no=%s trade_state=%s client_ip=%s", transaction.OutTradeNo, transaction.TradeState, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
		return
	}

	LockOrder(transaction.OutTradeNo)
	defer UnlockOrder(transaction.OutTradeNo)
	if err := model.RechargeWechatNative(transaction.OutTradeNo, int64(transaction.Amount.Total), c.ClientIP()); err != nil {
		if strings.Contains(err.Error(), "状态错误") {
			c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
			return
		}
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 Native 充值失败 trade_no=%s client_ip=%s error=%q", transaction.OutTradeNo, c.ClientIP(), err.Error()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "topup failed"})
		return
	}
	service.EmitPromotionTopupSucceeded(model.GetTopUpByTradeNo(transaction.OutTradeNo), "CNY")
	c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
}

func verifyWechatPayNotifySignature(notify *wechat.V3NotifyReq) error {
	publicKey, err := parseWechatPayPlatformPublicKey(setting.WechatNativePlatformCert)
	if err != nil {
		return err
	}
	return notify.VerifySignByPK(publicKey)
}

func parseWechatPayPlatformPublicKey(pemText string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(strings.TrimSpace(pemText)))
	if block == nil {
		return nil, errors.New("invalid platform cert pem")
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err == nil {
		if publicKey, ok := cert.PublicKey.(*rsa.PublicKey); ok {
			return publicKey, nil
		}
		return nil, errors.New("platform cert is not rsa")
	}
	publicKey, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	rsaKey, ok := publicKey.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("platform public key is not rsa")
	}
	return rsaKey, nil
}
