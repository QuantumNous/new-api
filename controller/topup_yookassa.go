package controller

import (
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
	"github.com/shopspring/decimal"
)

type YooKassaPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

type yooKassaWebhookPayload struct {
	Type   string `json:"type"`
	Event  string `json:"event"`
	Object struct {
		ID string `json:"id"`
	} `json:"object"`
}

func getYooKassaPayMoney(amount int64, group string) float64 {
	return getPayMoney(amount, group)
}

func formatYooKassaAmount(amount float64) string {
	return decimal.NewFromFloat(amount).Round(2).StringFixed(2)
}

func getYooKassaQuotaToAdd(amount int64) int {
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		return int(amount)
	}
	return int(decimal.NewFromInt(amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart())
}

func getYooKassaReturnURL() string {
	if strings.TrimSpace(setting.YooKassaReturnURL) != "" {
		return setting.YooKassaReturnURL
	}
	return paymentReturnPath("/console/topup?show_history=true")
}

func isYooKassaPaymentMethodEnabled(paymentMethod string) bool {
	method := strings.TrimSpace(paymentMethod)
	if method == "" {
		return false
	}
	if method == model.PaymentMethodYooKassaSBP {
		method = "sbp"
	}
	for _, configured := range strings.Split(setting.YooKassaPaymentMethods, ",") {
		if strings.EqualFold(strings.TrimSpace(configured), method) {
			return true
		}
	}
	return false
}

func RequestYooKassaAmount(c *gin.Context) {
	var req AmountRequest
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
	payMoney := getYooKassaPayMoney(req.Amount, group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": formatYooKassaAmount(payMoney)})
}

func RequestYooKassaPay(c *gin.Context) {
	if !isYooKassaTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "YooKassa 支付未启用"})
		return
	}

	var req YooKassaPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < getMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
		return
	}
	if !isYooKassaPaymentMethodEnabled(req.PaymentMethod) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付方式不存在"})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getYooKassaPayMoney(req.Amount, group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	tradeNo := fmt.Sprintf("USR%dNO%s%d", id, common.GetRandomString(6), time.Now().Unix())
	quotaToAdd := getYooKassaQuotaToAdd(req.Amount)
	topUp := &model.TopUp{
		UserId:          id,
		Amount:          req.Amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodYooKassaSBP,
		PaymentProvider: model.PaymentProviderYooKassa,
		QuotaToAdd:      quotaToAdd,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("YooKassa 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	ctx, cancel := service.YooKassaRequestTimeoutContext(c.Request.Context())
	defer cancel()
	request := service.NewYooKassaPaymentRequest(tradeNo, id, topUp.Id, formatYooKassaAmount(payMoney), getYooKassaReturnURL(), "sbp")
	payment, err := service.NewYooKassaClient(nil).CreatePayment(ctx, tradeNo, request)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("YooKassa 创建支付失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderYooKassa, common.TopUpStatusFailed)
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	metadataBytes, _ := common.Marshal(map[string]string{
		"trade_no":     tradeNo,
		"user_id":      fmt.Sprintf("%d", id),
		"topup_id":     fmt.Sprintf("%d", topUp.Id),
		"quota_to_add": fmt.Sprintf("%d", quotaToAdd),
	})
	paymentMetadata := &model.PaymentMetadata{
		TradeNo:           tradeNo,
		PaymentProvider:   model.PaymentProviderYooKassa,
		ExternalPaymentID: payment.ID,
		Metadata:          string(metadataBytes),
		CreateTime:        time.Now().Unix(),
		UpdateTime:        time.Now().Unix(),
	}
	if err := paymentMetadata.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("YooKassa 保存支付元数据失败 trade_no=%s payment_id=%s error=%q", tradeNo, payment.ID, err.Error()))
	}

	confirmationURL := strings.TrimSpace(payment.Confirmation.ConfirmationURL)
	if confirmationURL == "" {
		logger.LogError(c.Request.Context(), fmt.Sprintf("YooKassa 响应缺少 confirmation_url user_id=%d trade_no=%s payment_id=%s", id, tradeNo, payment.ID))
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderYooKassa, common.TopUpStatusFailed)
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("YooKassa 充值订单创建成功 user_id=%d trade_no=%s payment_id=%s amount=%d money=%.2f", id, tradeNo, payment.ID, req.Amount, payMoney))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"confirmation_url": confirmationURL,
			"payment_id":       payment.ID,
			"trade_no":         tradeNo,
		},
	})
}

func YooKassaNotify(c *gin.Context) {
	if !isYooKassaWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("YooKassa webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	var payload yooKassaWebhookPayload
	if err := common.DecodeJson(c.Request.Body, &payload); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("YooKassa webhook 参数错误 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if payload.Event != "payment.succeeded" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("YooKassa webhook 忽略事件 notification_type=%s event=%s payment_id=%s client_ip=%s", payload.Type, payload.Event, payload.Object.ID, c.ClientIP()))
		c.Status(http.StatusOK)
		return
	}

	ctx, cancel := service.YooKassaRequestTimeoutContext(c.Request.Context())
	defer cancel()
	payment, err := service.NewYooKassaClient(nil).GetPayment(ctx, payload.Object.ID)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("YooKassa 查询支付失败 payment_id=%s client_ip=%s error=%q", payload.Object.ID, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadGateway)
		return
	}

	tradeNo := payment.Metadata["trade_no"]
	if tradeNo == "" {
		metadata := model.GetPaymentMetadataByExternalPaymentID(model.PaymentProviderYooKassa, payment.ID)
		if metadata != nil {
			tradeNo = metadata.TradeNo
		}
	}
	if tradeNo == "" {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("YooKassa webhook 缺少 trade_no payment_id=%s client_ip=%s", payment.ID, c.ClientIP()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.PaymentProvider != model.PaymentProviderYooKassa {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("YooKassa webhook 订单不存在或网关不匹配 trade_no=%s payment_id=%s client_ip=%s", tradeNo, payment.ID, c.ClientIP()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if err := validateYooKassaPayment(payment, topUp); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("YooKassa webhook 支付校验失败 trade_no=%s payment_id=%s client_ip=%s error=%q", tradeNo, payment.ID, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if err := model.RechargeYooKassa(tradeNo, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("YooKassa 充值失败 trade_no=%s payment_id=%s client_ip=%s error=%q", tradeNo, payment.ID, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	c.Status(http.StatusOK)
}

func validateYooKassaPayment(payment *service.YooKassaPayment, topUp *model.TopUp) error {
	if payment.Status != "succeeded" {
		return fmt.Errorf("unexpected status %s", payment.Status)
	}
	if !payment.Paid {
		return fmt.Errorf("payment is not paid")
	}
	if payment.Amount.Currency != service.YooKassaCurrencyRUB {
		return fmt.Errorf("unexpected currency %s", payment.Amount.Currency)
	}
	expectedAmount := decimal.NewFromFloat(topUp.Money).Round(2)
	actualAmount, err := decimal.NewFromString(payment.Amount.Value)
	if err != nil {
		return err
	}
	if !actualAmount.Equal(expectedAmount) {
		return fmt.Errorf("amount mismatch expected %s actual %s", expectedAmount.StringFixed(2), actualAmount.StringFixed(2))
	}
	if metadataTradeNo := payment.Metadata["trade_no"]; metadataTradeNo != "" && metadataTradeNo != topUp.TradeNo {
		return fmt.Errorf("trade_no mismatch")
	}
	return nil
}
