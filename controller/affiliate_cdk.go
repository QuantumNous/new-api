package controller

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

type affiliateCdkQuoteRequest struct {
	Amount   int64 `json:"amount"`
	Quantity int   `json:"quantity"`
}

type affiliateCdkEpayPayRequest struct {
	Amount        int64  `json:"amount"`
	Quantity      int    `json:"quantity"`
	PaymentMethod string `json:"payment_method"`
}

func requireSelfAffiliateCdkPermission(c *gin.Context) bool {
	user, err := model.GetUserById(c.GetInt("id"), false)
	if err != nil {
		common.ApiError(c, err)
		return false
	}
	if !user.AffiliateCdkEnabled {
		common.ApiErrorMsg(c, "未开通 CDK 采购权限")
		return false
	}
	return true
}

func GetSelfAffiliateCdkInfo(c *gin.Context) {
	if !requireSelfAffiliateCdkPermission(c) {
		return
	}
	if !requirePaymentCompliance(c) {
		return
	}

	distribution := operation_setting.GetDistributionSetting()
	discountConfigured := distribution.CdkPurchaseDiscountBps > 0 && distribution.CdkPurchaseDiscountBps < 10000
	payMethods := []map[string]string{}
	if isEpayTopUpEnabled() {
		payMethods = operation_setting.PayMethods
	}

	common.ApiSuccess(c, gin.H{
		"amount_options":               operation_setting.GetPaymentSetting().AmountOptions,
		"discount":                     operation_setting.GetPaymentSetting().AmountDiscount,
		"pay_methods":                  payMethods,
		"enable_epay":                  isEpayTopUpEnabled(),
		"min_topup":                    model.MinTopUpAmountForDisplay(),
		"max_quantity":                 model.AffiliateCdkOrderMaxQuantity,
		"cdk_purchase_discount_bps":    distribution.CdkPurchaseDiscountBps,
		"discount_configured":          discountConfigured,
		"enable_cdk_purchase":          discountConfigured && isEpayTopUpEnabled(),
		"payment_compliance_confirmed": true,
	})
}

func QuoteSelfAffiliateCdk(c *gin.Context) {
	if !requireSelfAffiliateCdkPermission(c) {
		return
	}
	if !requirePaymentCompliance(c) {
		return
	}
	var req affiliateCdkQuoteRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	quote, err := model.QuoteAffiliateCdkOrder(c.GetInt("id"), req.Amount, req.Quantity)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, quote)
}

func RequestSelfAffiliateCdkEpay(c *gin.Context) {
	if !requireSelfAffiliateCdkPermission(c) {
		return
	}
	if !requirePaymentCompliance(c) {
		return
	}
	if !isEpayTopUpEnabled() {
		common.ApiErrorMsg(c, "当前管理员未配置支付信息")
		return
	}
	var req affiliateCdkEpayPayRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if !operation_setting.ContainsPayMethod(req.PaymentMethod) {
		common.ApiErrorMsg(c, "支付方式不存在")
		return
	}

	userId := c.GetInt("id")
	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("CDKUSR%dNO%s", userId, tradeNo)
	order, _, err := model.BuildAffiliateCdkOrder(userId, req.Amount, req.Quantity, tradeNo, req.PaymentMethod)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := order.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("易支付 创建代理 CDK 订单失败 user_id=%d trade_no=%s amount=%d quantity=%d error=%q", userId, tradeNo, req.Amount, req.Quantity, err.Error()))
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	callBackAddress := service.GetCallbackAddress()
	returnUrl, err := url.Parse(callBackAddress + "/api/affiliate/cdk/epay/return")
	if err != nil {
		_ = model.ExpireAffiliateCdkOrder(tradeNo, model.PaymentProviderEpay)
		common.ApiErrorMsg(c, "回调地址配置错误")
		return
	}
	notifyUrl, err := url.Parse(callBackAddress + "/api/affiliate/cdk/epay/notify")
	if err != nil {
		_ = model.ExpireAffiliateCdkOrder(tradeNo, model.PaymentProviderEpay)
		common.ApiErrorMsg(c, "回调地址配置错误")
		return
	}

	client := GetEpayClient()
	if client == nil {
		_ = model.ExpireAffiliateCdkOrder(tradeNo, model.PaymentProviderEpay)
		common.ApiErrorMsg(c, "当前管理员未配置支付信息")
		return
	}
	uri, params, err := client.Purchase(&epay.PurchaseArgs{
		Type:           req.PaymentMethod,
		ServiceTradeNo: tradeNo,
		Name:           fmt.Sprintf("CDK:%d*%d", order.CodeAmount, order.Quantity),
		Money:          strconv.FormatFloat(order.PayAmount, 'f', 2, 64),
		Device:         epay.PC,
		NotifyUrl:      notifyUrl,
		ReturnUrl:      returnUrl,
	})
	if err != nil {
		_ = model.ExpireAffiliateCdkOrder(tradeNo, model.PaymentProviderEpay)
		logger.LogError(c.Request.Context(), fmt.Sprintf("易支付 拉起代理 CDK 支付失败 user_id=%d trade_no=%s payment_method=%s amount=%d quantity=%d error=%q", userId, tradeNo, req.PaymentMethod, req.Amount, req.Quantity, err.Error()))
		common.ApiErrorMsg(c, "拉起支付失败")
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("易支付 代理 CDK 订单创建成功 user_id=%d trade_no=%s payment_method=%s amount=%d quantity=%d pay_amount=%.2f", userId, tradeNo, req.PaymentMethod, req.Amount, req.Quantity, order.PayAmount))
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": params, "url": uri})
}

func GetSelfAffiliateCdkOrders(c *gin.Context) {
	if !requireSelfAffiliateCdkPermission(c) {
		return
	}
	if !requirePaymentCompliance(c) {
		return
	}
	status := c.Query("status")
	if status != "" &&
		status != common.TopUpStatusPending &&
		status != common.TopUpStatusSuccess &&
		status != common.TopUpStatusFailed &&
		status != common.TopUpStatusExpired {
		common.ApiErrorMsg(c, "无效的订单状态")
		return
	}
	pageInfo := common.GetPageQuery(c)
	orders, total, err := model.ListAffiliateCdkOrders(model.AffiliateCdkOrderQuery{
		UserId: c.GetInt("id"),
		Status: status,
	}, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(orders)
	common.ApiSuccess(c, pageInfo)
}

func GetSelfAffiliateCdkOrderCodes(c *gin.Context) {
	if !requireSelfAffiliateCdkPermission(c) {
		return
	}
	if !requirePaymentCompliance(c) {
		return
	}
	orderId, err := strconv.Atoi(c.Param("id"))
	if err != nil || orderId <= 0 {
		common.ApiErrorMsg(c, "无效的订单 ID")
		return
	}
	codes, err := model.ListAffiliateCdkOrderCodes(c.GetInt("id"), orderId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, codes)
}

func GetSelfAffiliateCdkCodes(c *gin.Context) {
	if !requireSelfAffiliateCdkPermission(c) {
		return
	}
	if !requirePaymentCompliance(c) {
		return
	}
	status := 0
	statusQuery := c.Query("status")
	if statusQuery != "" {
		parsedStatus, err := strconv.Atoi(statusQuery)
		if err != nil ||
			(parsedStatus != common.RedemptionCodeStatusEnabled &&
				parsedStatus != common.RedemptionCodeStatusDisabled &&
				parsedStatus != common.RedemptionCodeStatusUsed) {
			common.ApiErrorMsg(c, "无效的兑换码状态")
			return
		}
		status = parsedStatus
	}
	pageInfo := common.GetPageQuery(c)
	codes, total, err := model.ListAffiliateCdkCodes(model.AffiliateCdkCodeQuery{
		UserId: c.GetInt("id"),
		Status: status,
	}, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func AffiliateCdkEpayNotify(c *gin.Context) {
	if !isEpayWebhookEnabled() {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	params, err := readEpayCallbackParams(c)
	if err != nil || len(params) == 0 {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	client := GetEpayClient()
	if client == nil {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	verifyInfo, err := client.Verify(params)
	if err != nil || !verifyInfo.VerifyStatus {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	if verifyInfo.TradeStatus != epay.StatusTradeSuccess {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	LockOrder(verifyInfo.ServiceTradeNo)
	defer UnlockOrder(verifyInfo.ServiceTradeNo)

	if err := model.CompleteAffiliateCdkOrder(verifyInfo.ServiceTradeNo, common.GetJsonString(verifyInfo), model.PaymentProviderEpay, verifyInfo.Type); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("易支付 完成代理 CDK 订单失败 trade_no=%s client_ip=%s error=%q", verifyInfo.ServiceTradeNo, c.ClientIP(), err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	_, _ = c.Writer.Write([]byte("success"))
}

func AffiliateCdkEpayReturn(c *gin.Context) {
	params, err := readEpayCallbackParams(c)
	if err != nil || len(params) == 0 {
		c.Redirect(http.StatusFound, paymentResultPath("affiliate_cdk", "fail"))
		return
	}
	client := GetEpayClient()
	if client == nil {
		c.Redirect(http.StatusFound, paymentResultPath("affiliate_cdk", "fail"))
		return
	}
	verifyInfo, err := client.Verify(params)
	if err != nil || !verifyInfo.VerifyStatus {
		c.Redirect(http.StatusFound, paymentResultPath("affiliate_cdk", "fail"))
		return
	}
	if verifyInfo.TradeStatus == epay.StatusTradeSuccess {
		LockOrder(verifyInfo.ServiceTradeNo)
		defer UnlockOrder(verifyInfo.ServiceTradeNo)
		if err := model.CompleteAffiliateCdkOrder(verifyInfo.ServiceTradeNo, common.GetJsonString(verifyInfo), model.PaymentProviderEpay, verifyInfo.Type); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("易支付 return 完成代理 CDK 订单失败 trade_no=%s client_ip=%s error=%q", verifyInfo.ServiceTradeNo, c.ClientIP(), err.Error()))
			c.Redirect(http.StatusFound, paymentResultPath("affiliate_cdk", "fail"))
			return
		}
		c.Redirect(http.StatusFound, paymentResultPath("affiliate_cdk", "success"))
		return
	}
	c.Redirect(http.StatusFound, paymentResultPath("affiliate_cdk", "pending"))
}
