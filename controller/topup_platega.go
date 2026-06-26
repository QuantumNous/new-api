package controller

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/thanhpk/randstr"
)

type PlategaPayRequest struct {
	Amount int64 `json:"amount"`
}

func RequestPlategaAmount(c *gin.Context) {
	var req PlategaPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgInvalidParams)})
		return
	}
	if req.Amount < int64(setting.PlategaMinTopUp) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", setting.PlategaMinTopUp)})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	rubAmount := getPlategaPayRubAmount(req.Amount, group)
	if rubAmount <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"rub_amount":  fmt.Sprintf("%.2f", rubAmount),
			"usd_amount":  req.Amount,
			"usd_to_rub":  setting.PlategaUSDRate,
		},
	})
}

func getPlategaPayRubAmount(amount int64, group string) float64 {
	dAmount := decimal.NewFromInt(amount)
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount = dAmount.Div(decimal.NewFromFloat(common.QuotaPerUnit))
	}

	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}

	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(amount)]; ok && ds > 0 {
		discount = ds
	}

	rate := setting.PlategaUSDRate
	if rate <= 0 {
		rate = 90
	}

	payRub := dAmount.
		Mul(decimal.NewFromFloat(rate)).
		Mul(decimal.NewFromFloat(topupGroupRatio)).
		Mul(decimal.NewFromFloat(discount))

	return payRub.InexactFloat64()
}

func normalizePlategaTopUpAmount(amount int64) int64 {
	if operation_setting.GetQuotaDisplayType() != operation_setting.QuotaDisplayTypeTokens {
		return amount
	}
	return decimal.NewFromInt(amount).Div(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart()
}

func getPlategaReturnURL() string {
	if strings.TrimSpace(setting.PlategaReturnURL) != "" {
		return setting.PlategaReturnURL
	}
	return strings.TrimRight(system_setting.ServerAddress, "/") + "/console/wallet?show_history=true"
}

func getPlategaFailedURL() string {
	if strings.TrimSpace(setting.PlategaFailedURL) != "" {
		return setting.PlategaFailedURL
	}
	return getPlategaReturnURL()
}

func RequestPlategaPay(c *gin.Context) {
	if !isPlategaTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Platega 充值未启用"})
		return
	}

	var req PlategaPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgInvalidParams)})
		return
	}
	if req.Amount < int64(setting.PlategaMinTopUp) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", setting.PlategaMinTopUp)})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	payRub := getPlategaPayRubAmount(req.Amount, group)
	if payRub <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	tradeNo := fmt.Sprintf("PLATEGA-%d-%d-%s", id, time.Now().UnixMilli(), randstr.String(6))
	normalizedAmount := normalizePlategaTopUpAmount(req.Amount)

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          normalizedAmount,
		Money:           payRub,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodPlatega,
		PaymentProvider: model.PaymentProviderPlatega,
		CreateTime:      common.GetTimestamp(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.FillCountryFromIP(c.ClientIP()).Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Platega 创建本地订单失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	createReq := &service.PlategaCreateTransactionRequest{
		PaymentDetails: service.PlategaPaymentDetails{
			Amount:   payRub,
			Currency: "RUB",
		},
		Description: "APIMaster.ai balance top-up",
		Return:      getPlategaReturnURL(),
		FailedURL:   getPlategaFailedURL(),
		Payload:     tradeNo,
	}

	resp, reqJSON, err := service.CreatePlategaTransaction(c.Request.Context(), createReq)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Platega 创建支付失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderPlatega, common.TopUpStatusFailed)
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	respJSON, _ := json.Marshal(resp)
	plategaOrder := &model.PlategaOrder{
		TradeNo:              tradeNo,
		UserId:               id,
		RubAmount:            payRub,
		UsdQuotaAmount:       normalizedAmount,
		PlategaTransactionId: resp.TransactionId,
		PaymentMethod:        model.PlategaPaymentMethodSBPQR,
		PlategaStatus:        model.PlategaStatusPending,
		Payload:              tradeNo,
		CreateRequestJSON:    string(reqJSON),
		CreateResponseJSON:   string(respJSON),
		CreateTime:           common.GetTimestamp(),
		UpdateTime:           common.GetTimestamp(),
	}
	if err := plategaOrder.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Platega 保存订单扩展信息失败 trade_no=%s error=%q", tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "保存订单失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Platega 充值订单创建成功 user_id=%d trade_no=%s transaction_id=%s rub=%.2f amount=%d", id, tradeNo, resp.TransactionId, payRub, normalizedAmount))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"redirect_url":   resp.Redirect,
			"transaction_id": resp.TransactionId,
			"order_id":       tradeNo,
			"rub_amount":     payRub,
			"status":         resp.Status,
		},
	})
}

func PlategaCallback(c *gin.Context) {
	if !isPlategaWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Platega callback rejected reason=disabled client_ip=%s", c.ClientIP()))
		c.String(http.StatusForbidden, "webhook disabled")
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Platega callback read body failed client_ip=%s error=%q", c.ClientIP(), err.Error()))
		c.String(http.StatusBadRequest, "bad request")
		return
	}

	headersJSON, _ := json.Marshal(c.Request.Header)
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Platega callback received client_ip=%s headers=%s body=%s", c.ClientIP(), string(headersJSON), string(bodyBytes)))

	if err := handlePlategaCallback(c, bodyBytes, string(headersJSON)); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Platega callback handling issue client_ip=%s error=%q body=%s", c.ClientIP(), err.Error(), string(bodyBytes)))
	}
	c.String(http.StatusOK, "OK")
}

func handlePlategaCallback(c *gin.Context, bodyBytes []byte, headersJSON string) error {
	var payload service.PlategaCallbackPayload
	if err := json.Unmarshal(bodyBytes, &payload); err != nil {
		return fmt.Errorf("invalid callback json: %w", err)
	}

	order := resolvePlategaOrderFromCallback(&payload)
	if order == nil {
		return fmt.Errorf("platega order not found transactionId=%s payload=%s", payload.TransactionId, payload.Payload)
	}

	order.CallbackJSON = string(bodyBytes)
	order.CallbackHeadersJSON = headersJSON
	order.UpdateTime = common.GetTimestamp()
	if err := order.Save(); err != nil {
		return err
	}

	if amount, err := service.ParsePlategaCallbackAmount(payload.Amount); err == nil && amount > 0 {
		if !service.PlategaAmountsMatch(order.RubAmount, amount) {
			return fmt.Errorf("amount mismatch expected=%.2f actual=%.2f trade_no=%s", order.RubAmount, amount, order.TradeNo)
		}
	}

	normalized := model.NormalizePlategaAPIStatus(payload.Status)
	switch normalized {
	case model.PlategaStatusConfirmed:
		LockOrder(order.TradeNo)
		defer UnlockOrder(order.TradeNo)
		if order.PlategaStatus != model.PlategaStatusConfirmed {
			if err := order.ApplyPlategaStatus(payload.Status); err != nil {
				return err
			}
		}
		return model.RechargePlatega(order.TradeNo, c.ClientIP())
	case model.PlategaStatusCanceled:
		LockOrder(order.TradeNo)
		defer UnlockOrder(order.TradeNo)
		if err := order.ApplyPlategaStatus(payload.Status); err != nil {
			return err
		}
		return model.MarkTopUpCanceledForPlatega(order.TradeNo)
	case model.PlategaStatusChargeback:
		LockOrder(order.TradeNo)
		defer UnlockOrder(order.TradeNo)
		if err := order.ApplyPlategaStatus(payload.Status); err != nil {
			return err
		}
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Platega chargeback recorded trade_no=%s transaction_id=%s — manual review required", order.TradeNo, order.PlategaTransactionId))
		return nil
	default:
		return nil
	}
}

func resolvePlategaOrderFromCallback(payload *service.PlategaCallbackPayload) *model.PlategaOrder {
	if payload == nil {
		return nil
	}
	if order := model.GetPlategaOrderByTransactionId(payload.TransactionId); order != nil {
		return order
	}
	if order := model.GetPlategaOrderByPayload(payload.Payload); order != nil {
		return order
	}
	if order := model.GetPlategaOrderByTradeNo(payload.Payload); order != nil {
		return order
	}
	return nil
}

func AdminListPlategaOrders(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	orders, total, err := model.ListPlategaOrders(pageSize, (page-1)*pageSize)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"items": orders, "total": total, "page": page, "page_size": pageSize}})
}

type plategaAdminActionRequest struct {
	TradeNo       string `json:"trade_no"`
	TransactionId string `json:"transaction_id"`
}

func AdminQueryPlategaStatus(c *gin.Context) {
	var req plategaAdminActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid params"})
		return
	}
	order := model.GetPlategaOrderByTradeNo(req.TradeNo)
	if order == nil {
		order = model.GetPlategaOrderByTransactionId(req.TransactionId)
	}
	if order == nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "order not found"})
		return
	}
	status, err := service.GetPlategaTransactionStatus(c.Request.Context(), order.PlategaTransactionId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": status})
}

func AdminRetryPlategaCallback(c *gin.Context) {
	var req plategaAdminActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid params"})
		return
	}
	order := model.GetPlategaOrderByTradeNo(req.TradeNo)
	if order == nil {
		order = model.GetPlategaOrderByTransactionId(req.TransactionId)
	}
	if order == nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "order not found"})
		return
	}

	status, err := service.GetPlategaTransactionStatus(c.Request.Context(), order.PlategaTransactionId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	payload := service.PlategaCallbackPayload{
		TransactionId: order.PlategaTransactionId,
		Status:        status.Status,
		Payload:       order.Payload,
		Currency:      "RUB",
		PaymentMethod: json.RawMessage(`"` + model.PlategaPaymentMethodSBPQR + `"`),
	}
	if status.Amount > 0 {
		amountBytes, _ := json.Marshal(status.Amount)
		payload.Amount = amountBytes
	}
	bodyBytes, _ := json.Marshal(payload)
	if err := handlePlategaCallback(c, bodyBytes, `{"source":"admin-retry"}`); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "processed"})
}
