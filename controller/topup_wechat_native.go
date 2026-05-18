package controller

import (
	"bytes"
	"context"
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"math/big"
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
	"github.com/shopspring/decimal"
)

const wechatNativeTransactionsURL = "https://api.mch.weixin.qq.com/v3/pay/transactions/native"

type WechatNativePayRequest struct {
	Amount int64 `json:"amount"`
}

type wechatNativeTransactionRequest struct {
	AppID       string                        `json:"appid"`
	MchID       string                        `json:"mchid"`
	Description string                        `json:"description"`
	OutTradeNo  string                        `json:"out_trade_no"`
	NotifyURL   string                        `json:"notify_url"`
	Amount      wechatNativeTransactionAmount `json:"amount"`
}

type wechatNativeTransactionAmount struct {
	Total    int64  `json:"total"`
	Currency string `json:"currency"`
}

type wechatNativeTransactionResponse struct {
	CodeURL string `json:"code_url"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

type wechatNativeNotifyResource struct {
	Algorithm      string `json:"algorithm"`
	Ciphertext     string `json:"ciphertext"`
	Nonce          string `json:"nonce"`
	AssociatedData string `json:"associated_data"`
}

type wechatNativeNotifyRequest struct {
	ID           string                     `json:"id"`
	EventType    string                     `json:"event_type"`
	ResourceType string                     `json:"resource_type"`
	Resource     wechatNativeNotifyResource `json:"resource"`
}

type wechatNativeNotifyTransaction struct {
	OutTradeNo string `json:"out_trade_no"`
	TradeState string `json:"trade_state"`
	Amount     struct {
		Total int64 `json:"total"`
	} `json:"amount"`
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
		PaymentMethod: model.PaymentMethodWechatNative,
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
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentMethodWechatNative, common.TopUpStatusFailed)
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"code_url": codeURL, "trade_no": tradeNo}})
}

func createWechatNativeTransaction(ctx context.Context, tradeNo string, amount int64, moneyCents int64) (string, error) {
	notifyURL := service.GetCallbackAddress() + "/api/user/wechat-native/notify"
	body := wechatNativeTransactionRequest{
		AppID:       setting.WechatNativeAppId,
		MchID:       setting.WechatNativeMchId,
		Description: fmt.Sprintf("TUC%d", amount),
		OutTradeNo:  tradeNo,
		NotifyURL:   notifyURL,
		Amount: wechatNativeTransactionAmount{
			Total:    moneyCents,
			Currency: "CNY",
		},
	}
	bodyBytes, err := common.Marshal(body)
	if err != nil {
		return "", err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, wechatNativeTransactionsURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/json")
	authorization, err := buildWechatPayAuthorization(http.MethodPost, "/v3/pay/transactions/native", string(bodyBytes))
	if err != nil {
		return "", err
	}
	request.Header.Set("Authorization", authorization)

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	var result wechatNativeTransactionResponse
	if err := common.DecodeJson(response.Body, &result); err != nil {
		return "", err
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		if result.Message != "" {
			return "", errors.New(result.Message)
		}
		return "", fmt.Errorf("wechat pay status %d", response.StatusCode)
	}
	if result.CodeURL == "" {
		return "", errors.New("微信支付未返回二维码链接")
	}
	return result.CodeURL, nil
}

func WechatNativeNotify(c *gin.Context) {
	if !isWechatNativeWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 Native webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "webhook disabled"})
		return
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "read body failed"})
		return
	}
	if !verifyWechatPayNotifySignature(c, body) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 Native webhook 验签失败 path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "signature verify failed"})
		return
	}

	var notify wechatNativeNotifyRequest
	if err := common.Unmarshal(body, &notify); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 Native webhook 解析失败 client_ip=%s error=%q", c.ClientIP(), err.Error()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "invalid payload"})
		return
	}
	plaintext, err := decryptWechatPayResource(notify.Resource)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("微信支付 Native webhook 解密失败 client_ip=%s error=%q", c.ClientIP(), err.Error()))
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "decrypt failed"})
		return
	}

	var transaction wechatNativeNotifyTransaction
	if err := common.Unmarshal(plaintext, &transaction); err != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL", "message": "invalid transaction"})
		return
	}
	if transaction.TradeState != "SUCCESS" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付 Native webhook 忽略事件 trade_no=%s trade_state=%s client_ip=%s", transaction.OutTradeNo, transaction.TradeState, c.ClientIP()))
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
		return
	}

	LockOrder(transaction.OutTradeNo)
	defer UnlockOrder(transaction.OutTradeNo)
	if err := model.RechargeWechatNative(transaction.OutTradeNo, transaction.Amount.Total, c.ClientIP()); err != nil {
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

func buildWechatPayAuthorization(method string, canonicalURL string, body string) (string, error) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	nonce, err := randomWechatPayNonce()
	if err != nil {
		return "", err
	}
	message := strings.Join([]string{method, canonicalURL, timestamp, nonce, body}, "\n") + "\n"
	signature, err := signWechatPayMessage(message)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`WECHATPAY2-SHA256-RSA2048 mchid="%s",nonce_str="%s",signature="%s",timestamp="%s",serial_no="%s"`, setting.WechatNativeMchId, nonce, signature, timestamp, setting.WechatNativeMerchantSerialNo), nil
}

func signWechatPayMessage(message string) (string, error) {
	privateKey, err := parseWechatPayPrivateKey(setting.WechatNativeMerchantPrivateKey)
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256([]byte(message))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, hash[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

func verifyWechatPayNotifySignature(c *gin.Context, body []byte) bool {
	timestamp := c.GetHeader("Wechatpay-Timestamp")
	nonce := c.GetHeader("Wechatpay-Nonce")
	signatureText := c.GetHeader("Wechatpay-Signature")
	serial := c.GetHeader("Wechatpay-Serial")
	if timestamp == "" || nonce == "" || signatureText == "" || serial == "" {
		return false
	}

	publicKey, err := parseWechatPayPlatformPublicKey(setting.WechatNativePlatformCert)
	if err != nil {
		return false
	}
	signature, err := base64.StdEncoding.DecodeString(signatureText)
	if err != nil {
		return false
	}
	message := timestamp + "\n" + nonce + "\n" + string(body) + "\n"
	hash := sha256.Sum256([]byte(message))
	return rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, hash[:], signature) == nil
}

func decryptWechatPayResource(resource wechatNativeNotifyResource) ([]byte, error) {
	if resource.Ciphertext == "" || resource.Nonce == "" {
		return nil, errors.New("missing resource fields")
	}
	ciphertext, err := base64.StdEncoding.DecodeString(resource.Ciphertext)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher([]byte(setting.WechatNativeApiV3Key))
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, []byte(resource.Nonce), ciphertext, []byte(resource.AssociatedData))
}

func parseWechatPayPrivateKey(pemText string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(strings.TrimSpace(pemText)))
	if block == nil {
		return nil, errors.New("invalid private key pem")
	}
	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if rsaKey, ok := key.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
	}
	return x509.ParsePKCS1PrivateKey(block.Bytes)
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

func randomWechatPayNonce() (string, error) {
	max := new(big.Int).Lsh(big.NewInt(1), 128)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%032x", n), nil
}
