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

func handleSubscriptionAlipayNotify(c *gin.Context, normalized map[string]string, outTradeNo string) (handled bool) {
	if outTradeNo == "" {
		return false
	}
	if normalized["app_id"] != setting.AlipayAppID {
		return false
	}
	if sellerID := strings.TrimSpace(setting.AlipaySellerID); sellerID != "" && normalized["seller_id"] != sellerID {
		return false
	}

	order := model.GetSubscriptionOrderByTradeNo(outTradeNo)
	if order == nil {
		return false
	}
	if order.PaymentProvider != model.PaymentProviderAlipay {
		return false
	}

	switch normalized["trade_status"] {
	case "TRADE_SUCCESS", "TRADE_FINISHED":
		if err := validateSubscriptionAlipaySuccessCallback(outTradeNo, normalized); err != nil {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay subscription 成功回调业务校验失败 trade_no=%s provider_trade_no=%s client_ip=%s error=%q", outTradeNo, normalized["trade_no"], c.ClientIP(), err.Error()))
			c.String(http.StatusBadRequest, "fail")
			return true
		}
		if err := model.CompleteSubscriptionOrder(outTradeNo, common.GetJsonString(normalized), model.PaymentProviderAlipay, model.PaymentMethodAlipay); err != nil {
			if errors.Is(err, model.ErrSubscriptionOrderNotFound) || errors.Is(err, model.ErrSubscriptionOrderStatusInvalid) || errors.Is(err, model.ErrPaymentMethodMismatch) {
				c.String(http.StatusOK, "success")
				return true
			}
			logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay subscription 订单处理失败 trade_no=%s client_ip=%s error=%q", outTradeNo, c.ClientIP(), err.Error()))
			c.String(http.StatusInternalServerError, "fail")
			return true
		}
	case "TRADE_CLOSED":
		if err := model.ExpireSubscriptionOrder(outTradeNo, model.PaymentProviderAlipay); err != nil &&
			!errors.Is(err, model.ErrSubscriptionOrderNotFound) &&
			!errors.Is(err, model.ErrPaymentMethodMismatch) {
			logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay subscription 标记过期失败 trade_no=%s client_ip=%s error=%q", outTradeNo, c.ClientIP(), err.Error()))
			c.String(http.StatusInternalServerError, "fail")
			return true
		}
	}

	c.String(http.StatusOK, "success")
	return true
}

type SubscriptionAlipayPayRequest struct {
	PlanId        int    `json:"plan_id"`
	PaymentMethod string `json:"payment_method"`
	ReturnURL     string `json:"return_url,omitempty"`
}

func getSubscriptionAlipayReturnURL(requested string) string {
	if strings.TrimSpace(requested) != "" {
		return requested
	}
	if strings.TrimSpace(setting.AlipayReturnURL) != "" {
		return setting.AlipayReturnURL
	}
	return paymentReturnPath("/console/topup?show_history=true")
}

func getSubscriptionAlipayNotifyURL() string {
	if strings.TrimSpace(setting.AlipayNotifyURL) != "" {
		return setting.AlipayNotifyURL
	}
	return strings.TrimRight(service.GetCallbackAddress(), "/") + "/api/subscription/alipay/notify"
}

func getSubscriptionAlipayMoney(amount float64) float64 {
	rate := operation_setting.USDExchangeRate
	if rate <= 0 {
		rate = 1
	}
	return amount * rate
}

func SubscriptionRequestAlipayPay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	if !isAlipayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentNotConfigured)})
		return
	}

	var req SubscriptionAlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgInvalidParams)})
		return
	}
	if req.PaymentMethod != model.PaymentMethodAlipay {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentChannelNotSupported)})
		return
	}
	if req.ReturnURL != "" && common.ValidateRedirectURL(req.ReturnURL) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": i18n.T(c, i18n.MsgPaymentSuccessRedirectUntrusted), "data": ""})
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorI18n(c, i18n.MsgSubscriptionNotEnabled)
		return
	}
	if plan.PriceAmount < 0.01 {
		common.ApiErrorI18n(c, i18n.MsgPaymentAmountTooLow)
		return
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user == nil {
		common.ApiErrorI18n(c, i18n.MsgUserNotExists)
		return
	}

	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorI18n(c, i18n.MsgSubscriptionPurchaseMax)
			return
		}
	}

	payMoney := getSubscriptionAlipayMoney(plan.PriceAmount)
	if payMoney < 0.01 {
		common.ApiErrorI18n(c, i18n.MsgPaymentAmountTooLow)
		return
	}

	reference := fmt.Sprintf("sub-ali-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	tradeNo := "sub_ref_" + common.Sha1([]byte(reference))
	method := service.GetAlipayPayMethod(c.Request)
	payURL, err := service.BuildAlipayPayURL(
		setting.AlipayGateway,
		setting.AlipayAppID,
		setting.AlipayPrivateKey,
		method,
		service.AlipayPagePayRequest{
			OutTradeNo:     tradeNo,
			TotalAmount:    service.FormatAlipayAmount(payMoney),
			Subject:        fmt.Sprintf("Subscription %s", plan.Title),
			ReturnURL:      getSubscriptionAlipayReturnURL(req.ReturnURL),
			NotifyURL:      getSubscriptionAlipayNotifyURL(),
			TimeoutExpress: service.DefaultAlipayTimeoutExpress(),
			ProductCode:    service.GetAlipayProductCode(method),
		},
	)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay 订阅支付链接创建失败 trade_no=%s plan_id=%d error=%q", tradeNo, plan.Id, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentStartFailed)})
		return
	}

	order := &model.SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipay,
		PaymentProvider: model.PaymentProviderAlipay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	order.ApplyPaymentSnapshot(buildPaymentSnapshot(plan.PriceAmount, payMoney, "CNY"))
	if err := model.CreateAlipaySubscriptionWithPendingTask(order, service.NextAlipayPendingQueryTime(time.Now())); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Alipay 创建订阅订单失败 user_id=%d trade_no=%s plan_id=%d error=%q", userId, tradeNo, plan.Id, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentCreateFailed)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_type": "redirect",
			"pay_url":  payURL,
			"trade_no": tradeNo,
		},
	})
}

func SubscriptionRequestAlipayNotify(c *gin.Context) {
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
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Alipay subscription webhook 验签失败 client_ip=%s error=%q", c.ClientIP(), err.Error()))
		c.String(http.StatusUnauthorized, "fail")
		return
	}

	outTradeNo := normalized["out_trade_no"]
	if handleSubscriptionAlipayNotify(c, normalized, outTradeNo) {
		return
	}
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

func validateSubscriptionAlipaySuccessCallback(outTradeNo string, normalized map[string]string) error {
	order := model.GetSubscriptionOrderByTradeNo(outTradeNo)
	if order == nil {
		return errors.New("订阅订单不存在")
	}
	if order.PaymentProvider != model.PaymentProviderAlipay {
		return errors.New("支付提供方不匹配")
	}
	if strings.TrimSpace(normalized["trade_no"]) == "" {
		return errors.New("缺少支付宝交易号")
	}

	expectedAmount, err := decimal.NewFromString(service.FormatAlipayAmount(order.Money))
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
