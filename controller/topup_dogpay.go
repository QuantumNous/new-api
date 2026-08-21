package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
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
	"github.com/shopspring/decimal"
)

type DogPayRequestData struct {
	Amount           float64 `json:"amount"`
	PaymentMethod    string  `json:"payment_method,omitempty"`
	CurrencyConfigId string  `json:"currency_config_id,omitempty"`
	PayChannel       string  `json:"pay_channel,omitempty"`
	SuccessURL       string  `json:"success_url,omitempty"`
	FailureURL       string  `json:"failure_url,omitempty"`
	CancelURL        string  `json:"cancel_url,omitempty"`
}

type dogPayCurrencyConfig struct {
	ID         string `json:"id"`
	PayChannel string `json:"pay_channel"`
	Currency   string `json:"currency"`
	Status     string `json:"status"`
}

func getDogPayCurrencyConfigID() (string, string, error) {
	res, err := service.DogPayRequest(http.MethodGet, "/open-api/v1/pay/currency-config", nil)
	if err != nil {
		return "", "", err
	}

	var response struct {
		Code    int             `json:"code"`
		Data    json.RawMessage `json:"data"`
		Message string          `json:"message"`
	}
	if err = common.Unmarshal(res, &response); err != nil {
		return "", "", err
	}
	if response.Code != 0 {
		return "", "", fmt.Errorf("currency config request failed with code %d: %s", response.Code, response.Message)
	}
	var configs []dogPayCurrencyConfig
	if err = common.Unmarshal(response.Data, &configs); err != nil {
		return "", "", fmt.Errorf("invalid currency config data: %w", err)
	}
	if configs == nil {
		return "", "", errors.New("currency config data must be an array")
	}

	for _, config := range configs {
		if !strings.EqualFold(strings.TrimSpace(config.Currency), "USDT") {
			continue
		}
		if !strings.EqualFold(strings.TrimSpace(config.PayChannel), dogPayPreferredPayChannel) {
			continue
		}
		if !strings.EqualFold(strings.TrimSpace(config.Status), "active") {
			continue
		}
		currencyConfigID := strings.TrimSpace(config.ID)
		payChannel := strings.TrimSpace(config.PayChannel)
		if currencyConfigID != "" && payChannel != "" {
			return currencyConfigID, payChannel, nil
		}
	}

	return "", "", errors.New("active USDT currency config response did not contain an id")
}

const (
	dogPayRedirectSuccessField = "success_url"
	dogPayRedirectFailureField = "failure_url"
	dogPayMaxTopUpUSD          = 10000.0
	dogPayPreferredPayChannel  = "pay_002"
)

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func resolveDogPayRedirectURL(rawURL string, defaultURL string) (string, error) {
	redirectURL := strings.TrimSpace(rawURL)
	if redirectURL == "" {
		return defaultURL, nil
	}
	if err := common.ValidateRedirectURL(redirectURL); err != nil {
		return "", err
	}
	return redirectURL, nil
}

func resolveDogPayRedirectURLs(req *DogPayRequestData, defaultURL string) (string, string, string, error) {
	successURL, err := resolveDogPayRedirectURL(req.SuccessURL, defaultURL)
	if err != nil {
		return "", "", dogPayRedirectSuccessField, err
	}

	failureURL, err := resolveDogPayRedirectURL(firstNonEmpty(req.FailureURL, req.CancelURL), defaultURL)
	if err != nil {
		return "", "", dogPayRedirectFailureField, err
	}

	return successURL, failureURL, "", nil
}

func getDogPayMoney(amount float64, group string) float64 {
	dAmount := decimal.NewFromFloat(amount)
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount = dAmount.Div(decimal.NewFromFloat(common.QuotaPerUnit))
	}

	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}

	dTopupGroupRatio := decimal.NewFromFloat(topupGroupRatio)
	dPrice := decimal.NewFromFloat(setting.DogPayPrice)

	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(amount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}
	dDiscount := decimal.NewFromFloat(discount)

	payMoney := dAmount.Mul(dPrice).Mul(dTopupGroupRatio).Mul(dDiscount)
	return payMoney.Round(2).InexactFloat64()
}

func getDogPayMinTopup() float64 {
	minTopup := setting.DogPayMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		return decimal.NewFromFloat(minTopup).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).InexactFloat64()
	}
	return minTopup
}

func getDogPayMaxTopup() float64 {
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		return decimal.NewFromFloat(dogPayMaxTopUpUSD).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).InexactFloat64()
	}
	return dogPayMaxTopUpUSD
}

func validateDogPayAmount(amount float64) error {
	minTopup := getDogPayMinTopup()
	maxTopup := getDogPayMaxTopup()
	if math.IsNaN(amount) || math.IsInf(amount, 0) {
		return errors.New("充值数量必须是有限数值")
	}
	if amount < minTopup {
		return fmt.Errorf("充值数量不能小于 %.2f", minTopup)
	}
	if amount > maxTopup {
		return fmt.Errorf("充值数量不能大于 %.2f", maxTopup)
	}
	return nil
}

func dogPayQuotaToCredit(amount float64) (int64, error) {
	dAmount := decimal.NewFromFloat(amount)
	if operation_setting.GetQuotaDisplayType() != operation_setting.QuotaDisplayTypeTokens {
		dAmount = dAmount.Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	}
	quota, clamp := common.QuotaFromDecimalChecked(dAmount)
	if clamp != nil || quota <= 0 {
		return 0, errors.New("无效的充值额度")
	}
	return int64(quota), nil
}

func getDogPayFee(payMoney float64) (fee float64, total float64) {
	dFeeRatio := decimal.NewFromFloat(setting.DogPayFee).Div(decimal.NewFromInt(100))
	fee = decimal.NewFromFloat(payMoney).Mul(dFeeRatio).Round(2).InexactFloat64()
	total = decimal.NewFromFloat(payMoney).Add(decimal.NewFromFloat(fee)).Round(2).InexactFloat64()
	return fee, total
}

func RequestDogPayAmount(c *gin.Context) {
	if !isDogPayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "DogPay 支付渠道未启用"})
		return
	}

	var req DogPayRequestData
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	if err := validateDogPayAmount(req.Amount); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "error", "data": err.Error()})
		return
	}

	userID := c.GetInt("id")
	group, err := model.GetUserGroup(userID, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	payMoney := getDogPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	fee, totalMoney := getDogPayFee(payMoney)
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_money":   payMoney,
			"fee":         fee,
			"total_money": totalMoney,
			"fee_ratio":   setting.DogPayFee,
		},
	})
}

func RequestDogPay(c *gin.Context) {
	if !isDogPayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "DogPay 支付渠道未启用"})
		return
	}

	var req DogPayRequestData
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	if req.PaymentMethod != "" && req.PaymentMethod != model.PaymentMethodDogPay {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的支付渠道"})
		return
	}

	if err := validateDogPayAmount(req.Amount); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "error", "data": err.Error()})
		return
	}

	defaultRedirectURL := paymentReturnPath("/wallet")
	successURL, failureURL, invalidRedirectField, err := resolveDogPayRedirectURLs(&req, defaultRedirectURL)
	if err != nil {
		if invalidRedirectField == dogPayRedirectSuccessField {
			c.JSON(http.StatusBadRequest, gin.H{"message": "支付成功重定向URL不在可信任域名列表中", "data": ""})
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"message": "支付失败重定向URL不在可信任域名列表中", "data": ""})
		}
		return
	}

	userID := c.GetInt("id")
	group, err := model.GetUserGroup(userID, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	payMoney := getDogPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	quotaToCredit, err := dogPayQuotaToCredit(req.Amount)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "error", "data": err.Error()})
		return
	}

	currencyConfigID, payChannel, err := getDogPayCurrencyConfigID()
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("DogPay 获取币种配置失败 user_id=%d error=%q", userID, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取 DogPay 币种配置失败"})
		return
	}

	fee, totalMoney := getDogPayFee(payMoney)

	tradeNo := fmt.Sprintf("DOGPAY-%d-%d-%s", userID, time.Now().UnixMilli(), common.GetRandomString(6))
	var amountToStore int64
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		storedAmount, clamp := common.QuotaFromDecimalChecked(decimal.NewFromFloat(req.Amount).Div(decimal.NewFromFloat(common.QuotaPerUnit)))
		if clamp != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "error", "data": "无效的充值数量"})
			return
		}
		amountToStore = int64(storedAmount)
	}
	topUp := &model.TopUp{
		UserId:                 userID,
		Amount:                 amountToStore,
		Money:                  payMoney,
		QuotaToCredit:          quotaToCredit,
		DogPayOrderAmount:      totalMoney,
		DogPayCurrencyConfigID: currencyConfigID,
		DogPayPayChannel:       payChannel,
		TradeNo:                tradeNo,
		PaymentMethod:          model.PaymentMethodDogPay,
		PaymentProvider:        model.PaymentProviderDogPay,
		CreateTime:             time.Now().Unix(),
		Status:                 common.TopUpStatusPending,
	}
	if err = topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("DogPay 创建本地充值订单失败 user_id=%d trade_no=%s error=%q", userID, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	payload := map[string]string{
		"orderAmount":      fmt.Sprintf("%.2f", totalMoney),
		"goodsName":        fmt.Sprintf("Topup %.2f", req.Amount),
		"callId":           tradeNo,
		"currencyConfigId": currencyConfigID,
		"successUrl":       successURL,
		"failureUrl":       failureURL,
		"payChannel":       payChannel,
	}

	res, err := service.DogPayRequest(http.MethodPost, "/open-api/v1/pay", payload)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("DogPay 拉起支付失败 user_id=%d trade_no=%s error=%q", userID, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起 DogPay 支付失败，订单已保留待处理"})
		return
	}

	var response struct {
		Code int `json:"code"`
		Data struct {
			PayInfo struct {
				PayURL string `json:"payUrl"`
			} `json:"payInfo"`
		} `json:"data"`
		Message string `json:"message"`
	}
	if err = common.Unmarshal(res, &response); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("DogPay 响应解析失败 user_id=%d trade_no=%s error=%q response=%q", userID, tradeNo, err.Error(), string(res)))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "解析响应失败"})
		return
	}

	if response.Code != 0 {
		if updateErr := model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderDogPay, common.TopUpStatusFailed); updateErr != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("DogPay 标记失败订单失败 trade_no=%s error=%q", tradeNo, updateErr.Error()))
		}
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("DogPay 响应异常 user_id=%d trade_no=%s code=%d message=%q", userID, tradeNo, response.Code, response.Message))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "DogPay 拉起支付失败"})
		return
	}

	payURL := strings.TrimSpace(response.Data.PayInfo.PayURL)
	if payURL == "" {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("DogPay 未返回支付链接 user_id=%d trade_no=%s response=%q", userID, tradeNo, string(res)))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "未获取到支付链接"})
		return
	}

	topUp.DogPayPayURL = payURL
	if err = topUp.Update(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("DogPay 保存支付链接失败 user_id=%d trade_no=%s error=%q", userID, tradeNo, err.Error()))
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("DogPay 充值订单创建成功 user_id=%d trade_no=%s amount=%.2f pay_money=%.2f total_money=%.2f", userID, tradeNo, req.Amount, payMoney, totalMoney))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link":    payURL,
			"trade_no":    tradeNo,
			"pay_money":   payMoney,
			"fee":         fee,
			"total_money": totalMoney,
		},
		"url":      payURL,
		"trade_no": tradeNo,
	})
}

type DogPayNotifyRequest struct {
	EventID         string `json:"event_id"`
	EventIdentifier string `json:"event_identifier"`
	Data            struct {
		ID               string `json:"id"`
		IDNo             string `json:"idNo"`
		PayIdNo          string `json:"payIdNo"`
		Status           string `json:"status"`
		Amount           string `json:"amount"`
		Currency         string `json:"currency"`
		CurrencyConfigID string `json:"currencyConfigId"`
		PayChannel       string `json:"payChannel"`
		CallID           string `json:"callId"`
		TxHash           string `json:"txHash"`
		TransferAmount   string `json:"transferAmount"`
	} `json:"data"`
}

func GetDogPayCurrencyConfigs(c *gin.Context) {
	if !isDogPayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "DogPay 未启用"})
		return
	}

	res, err := service.DogPayRequest(http.MethodGet, "/open-api/v1/pay/currency-config", nil)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取币种配置失败"})
		return
	}

	var response map[string]interface{}
	if err = common.Unmarshal(res, &response); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "解析币种配置失败"})
		return
	}

	c.JSON(http.StatusOK, response)
}

func DogPayWebhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.String(http.StatusBadRequest, "failure")
		return
	}
	providedSignature := c.GetHeader("wh-signature")
	if providedSignature == "" {
		providedSignature = c.GetHeader("X-Webhook-Signature")
	}
	if !service.VerifyDogPayWebhookSignature(setting.DogPayAppId, body, providedSignature) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("DogPay webhook 验签失败 client_ip=%s", c.ClientIP()))
		c.String(http.StatusUnauthorized, "failure")
		return
	}
	var req DogPayNotifyRequest
	if err = common.Unmarshal(body, &req); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("DogPay webhook JSON 解析失败 client_ip=%s error=%q", c.ClientIP(), err.Error()))
		c.String(http.StatusBadRequest, "failure")
		return
	}

	if req.EventIdentifier != "pay.transaction.update" || req.Data.Status != "completed" {
		c.String(http.StatusOK, "success")
		return
	}

	tradeNo := strings.TrimSpace(req.Data.CallID)
	if tradeNo == "" {
		c.String(http.StatusBadRequest, "failure")
		return
	}
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	txID := strings.TrimSpace(req.Data.TxHash)
	if txID == "" {
		txID = strings.TrimSpace(req.Data.ID)
	}
	if txID == "" {
		c.String(http.StatusBadRequest, "failure")
		return
	}

	callbackAmount := strings.TrimSpace(req.Data.Amount)
	topUp, quotaToAdd, credited, err := model.RechargeDogPay(
		tradeNo,
		txID,
		callbackAmount,
		req.Data.Currency,
		req.Data.CurrencyConfigID,
		req.Data.PayChannel,
		c.ClientIP(),
	)
	if err != nil {
		switch {
		case errors.Is(err, model.ErrTopUpNotFound):
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("DogPay webhook 订单不存在 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		case errors.Is(err, model.ErrPaymentMethodMismatch):
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("DogPay webhook 订单支付网关不匹配 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		case errors.Is(err, model.ErrTopUpStatusInvalid):
			logger.LogInfo(c.Request.Context(), fmt.Sprintf("DogPay webhook 忽略非 pending 订单 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		case errors.Is(err, model.ErrDogPayAmountMismatch), errors.Is(err, model.ErrDogPayCurrencyMismatch), errors.Is(err, model.ErrDogPayChannelMismatch), errors.Is(err, model.ErrDogPayQuotaInvalid), errors.Is(err, model.ErrDogPayQuotaOverflow):
			logger.LogError(c.Request.Context(), fmt.Sprintf("DogPay webhook 结算校验失败 trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
			c.String(http.StatusBadRequest, "failure")
			return
		default:
			logger.LogError(c.Request.Context(), fmt.Sprintf("DogPay webhook 处理失败 trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
			c.String(http.StatusInternalServerError, "failure")
			return
		}
	} else if credited {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("DogPay 充值成功 trade_no=%s user_id=%d client_ip=%s quota_to_add=%d money=%.2f", topUp.TradeNo, topUp.UserId, c.ClientIP(), quotaToAdd, topUp.Money))
	} else {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("DogPay webhook 重复回调已忽略 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
	}

	c.String(http.StatusOK, "success")
}
