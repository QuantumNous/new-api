package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/thanhpk/randstr"
)

type AlipayPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
	ReturnURL     string `json:"return_url,omitempty"`
}

func getAlipayMinTopup() int64 {
	minTopup := setting.AlipayMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		minTopup = minTopup * int(common.QuotaPerUnit)
	}
	return int64(minTopup)
}

func getAlipayReturnURL(requested string) string {
	if strings.TrimSpace(requested) != "" {
		return requested
	}
	if strings.TrimSpace(setting.AlipayReturnURL) != "" {
		return setting.AlipayReturnURL
	}
	return paymentReturnPath("/console/topup?show_history=true")
}

func getAlipayNotifyURL() string {
	if strings.TrimSpace(setting.AlipayNotifyURL) != "" {
		return setting.AlipayNotifyURL
	}
	return strings.TrimRight(service.GetCallbackAddress(), "/") + "/api/alipay/notify"
}

func normalizeAlipayTopUpAmount(amount int64) int64 {
	if operation_setting.GetQuotaDisplayType() != operation_setting.QuotaDisplayTypeTokens {
		return amount
	}
	normalized := int64(float64(amount) / common.QuotaPerUnit)
	if normalized < 1 {
		return 1
	}
	return normalized
}

func RequestAlipayPay(c *gin.Context) {
	if !isAlipayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentNotConfigured)})
		return
	}

	var req AlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgInvalidParams)})
		return
	}
	if req.PaymentMethod != model.PaymentMethodAlipay {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentChannelNotSupported)})
		return
	}
	if req.Amount < getAlipayMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentMinTopup, map[string]any{"Min": getAlipayMinTopup()})})
		return
	}
	if req.ReturnURL != "" && common.ValidateRedirectURL(req.ReturnURL) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": i18n.T(c, i18n.MsgPaymentSuccessRedirectUntrusted), "data": ""})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentUserGroupFailed)})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentAmountTooLow)})
		return
	}

	reference := fmt.Sprintf("ali-api-ref-%d-%d-%s", id, time.Now().UnixMilli(), randstr.String(4))
	tradeNo := "ali_ref_" + common.Sha1([]byte(reference))
	method := service.GetAlipayPayMethod(c.Request)
	payURL, err := service.BuildAlipayPayURL(
		setting.AlipayGateway,
		setting.AlipayAppID,
		setting.AlipayPrivateKey,
		method,
		service.AlipayPagePayRequest{
			OutTradeNo:     tradeNo,
			TotalAmount:    service.FormatAlipayAmount(payMoney),
			Subject:        fmt.Sprintf("Topup %d", req.Amount),
			ReturnURL:      getAlipayReturnURL(req.ReturnURL),
			NotifyURL:      getAlipayNotifyURL(),
			TimeoutExpress: service.DefaultAlipayTimeoutExpress(),
			ProductCode:    service.GetAlipayProductCode(method),
		},
	)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay 创建支付链接失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentStartFailed)})
		return
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          normalizeAlipayTopUpAmount(req.Amount),
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipay,
		PaymentProvider: model.PaymentProviderAlipay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	topUp.ApplyPaymentSnapshot(buildPaymentSnapshot(float64(req.Amount), payMoney, "CNY"))
	if err := model.CreateAlipayTopUpWithPendingTask(topUp, service.NextAlipayPendingQueryTime(time.Now())); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentCreateFailed)})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Alipay 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f method=%s", id, tradeNo, req.Amount, payMoney, method))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_type": "redirect",
			"pay_url":  payURL,
			"trade_no": tradeNo,
		},
	})
}

func AlipayNotify(c *gin.Context) {
	if !isAlipayWebhookEnabled() {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	if err := c.Request.ParseForm(); err != nil {
		c.String(http.StatusBadRequest, "fail")
		return
	}

	signature := c.Request.PostForm.Get("sign")
	normalized := service.NormalizeAlipayParams(c.Request.PostForm)
	content := service.BuildAlipaySignContent(normalized)
	if err := service.VerifyAlipaySignature(content, signature, setting.AlipayPublicKey); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay webhook 验签失败 client_ip=%s error=%q", c.ClientIP(), err.Error()))
		c.String(http.StatusUnauthorized, "fail")
		return
	}

	outTradeNo := normalized["out_trade_no"]
	if outTradeNo == "" {
		c.String(http.StatusBadRequest, "fail")
		return
	}
	if normalized["app_id"] != setting.AlipayAppID {
		c.String(http.StatusBadRequest, "fail")
		return
	}
	if sellerID := strings.TrimSpace(setting.AlipaySellerID); sellerID != "" && normalized["seller_id"] != sellerID {
		c.String(http.StatusBadRequest, "fail")
		return
	}

	if handleSubscriptionAlipayNotify(c, normalized, outTradeNo) {
		return
	}

	switch normalized["trade_status"] {
	case "TRADE_SUCCESS", "TRADE_FINISHED":
		if err := validateAlipaySuccessCallback(outTradeNo, normalized); err != nil {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay 成功回调业务校验失败 trade_no=%s provider_trade_no=%s client_ip=%s error=%q", outTradeNo, normalized["trade_no"], c.ClientIP(), err.Error()))
			c.String(http.StatusBadRequest, "fail")
			return
		}
		if err := model.RechargeAlipay(outTradeNo, c.ClientIP()); err != nil {
			if strings.Contains(err.Error(), "状态错误") {
				c.String(http.StatusOK, "success")
				return
			}
			logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay 充值处理失败 trade_no=%s client_ip=%s error=%q", outTradeNo, c.ClientIP(), err.Error()))
			c.String(http.StatusInternalServerError, "fail")
			return
		}
	case "TRADE_CLOSED":
		if err := model.UpdatePendingTopUpStatus(outTradeNo, model.PaymentProviderAlipay, common.TopUpStatusExpired); err != nil &&
			err != model.ErrTopUpNotFound &&
			err != model.ErrTopUpStatusInvalid {
			logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay 标记过期失败 trade_no=%s client_ip=%s error=%q", outTradeNo, c.ClientIP(), err.Error()))
			c.String(http.StatusInternalServerError, "fail")
			return
		}
		_ = model.DeleteAlipayPendingTask(outTradeNo)
	}

	c.String(http.StatusOK, "success")
}

func validateAlipaySuccessCallback(outTradeNo string, normalized map[string]string) error {
	topUp := model.GetTopUpByTradeNo(outTradeNo)
	if topUp == nil {
		return errors.New("充值订单不存在")
	}
	if topUp.PaymentProvider != model.PaymentProviderAlipay {
		return errors.New("支付提供方不匹配")
	}
	if strings.TrimSpace(normalized["trade_no"]) == "" {
		return errors.New("缺少支付宝交易号")
	}

	expectedAmount, err := decimal.NewFromString(service.FormatAlipayAmount(topUp.Money))
	if err != nil {
		return fmt.Errorf("本地金额格式化失败: %w", err)
	}
	if err := validateAlipayAmountField("total_amount", normalized["total_amount"], expectedAmount); err != nil {
		return err
	}
	if receiptAmount := strings.TrimSpace(normalized["receipt_amount"]); receiptAmount != "" {
		if err := validateAlipayAmountField("receipt_amount", receiptAmount, expectedAmount); err != nil {
			return err
		}
	}
	return nil
}

func validateAlipayAmountField(fieldName string, actual string, expected decimal.Decimal) error {
	actualAmount, err := decimal.NewFromString(strings.TrimSpace(actual))
	if err != nil {
		return fmt.Errorf("%s 格式非法", fieldName)
	}
	if !actualAmount.Equal(expected) {
		return fmt.Errorf("%s 不匹配: expected=%s actual=%s", fieldName, expected.StringFixed(2), actualAmount.StringFixed(2))
	}
	return nil
}
