package controller

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type AlipayPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
	ReturnTo      string `json:"return_to"`
}

type SubscriptionAlipayPayRequest struct {
	PlanId        int    `json:"plan_id"`
	PaymentMethod string `json:"payment_method"`
	ReturnTo      string `json:"return_to"`
}

type AlipayOrderDetailResponse struct {
	TradeNo     string  `json:"trade_no"`
	Scene       string  `json:"scene"`
	Title       string  `json:"title"`
	QRCode      string  `json:"qr_code,omitempty"`
	Status      string  `json:"status"`
	Amount      float64 `json:"amount"`
	ExpiresAt   int64   `json:"expires_at,omitempty"`
	ReturnTo    string  `json:"return_to"`
	TradeStatus string  `json:"trade_status,omitempty"`
}

func RequestAlipayPay(c *gin.Context) {
	var req AlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if req.PaymentMethod != service.PaymentMethodAlipayF2F {
		common.ApiErrorMsg(c, "不支持的支付渠道")
		return
	}
	if !service.AlipayF2FReady() {
		common.ApiErrorMsg(c, "支付宝当面付配置不完整")
		return
	}
	if req.Amount < getMinTopup() {
		common.ApiErrorMsg(c, fmt.Sprintf("充值数量不能小于 %d", getMinTopup()))
		return
	}

	userId := c.GetInt("id")
	group, err := model.GetUserGroup(userId, true)
	if err != nil {
		common.ApiErrorMsg(c, "获取用户分组失败")
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		common.ApiErrorMsg(c, "充值金额过低")
		return
	}

	tradeNo := fmt.Sprintf("USR%dNOALP%s%d", userId, common.GetRandomString(6), time.Now().Unix())
	returnTo := service.NormalizeInternalReturnTo(req.ReturnTo, "/console/topup")
	title := fmt.Sprintf("余额充值 %d", req.Amount)
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}

	topUp := &model.TopUp{
		UserId:        userId,
		Amount:        amount,
		Money:         payMoney,
		TradeNo:       tradeNo,
		PaymentMethod: service.PaymentMethodAlipayF2F,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	qrCode, providerPayload, err := createAlipayOrderPayload(c, tradeNo, service.AlipaySceneTopUp, title, payMoney, returnTo)
	if err != nil {
		topUp.Status = common.TopUpStatusFailed
		topUp.CompleteTime = common.GetTimestamp()
		_ = topUp.Update()
		common.ApiErrorMsg(c, err.Error())
		return
	}

	topUp.ProviderPayload = providerPayload
	if err := topUp.Update(); err != nil {
		common.ApiErrorMsg(c, "保存支付信息失败")
		return
	}

	common.ApiSuccess(c, gin.H{
		"trade_no":         tradeNo,
		"payment_page_url": service.BuildAlipayPaymentPageURL(tradeNo, returnTo, service.ResolveRequestBaseURL(c.Request)),
		"qr_code":          qrCode,
	})
}

func SubscriptionRequestAlipayPay(c *gin.Context) {
	var req SubscriptionAlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if req.PaymentMethod != "" && req.PaymentMethod != service.PaymentMethodAlipayF2F {
		common.ApiErrorMsg(c, "不支持的支付渠道")
		return
	}
	if !service.AlipayF2FReady() {
		common.ApiErrorMsg(c, "支付宝当面付配置不完整")
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorMsg(c, "套餐未启用")
		return
	}
	if plan.PriceAmount < 0.01 {
		common.ApiErrorMsg(c, "套餐金额过低")
		return
	}

	userId := c.GetInt("id")
	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorMsg(c, "已达到该套餐购买上限")
			return
		}
	}

	tradeNo := fmt.Sprintf("SUBUSR%dNOALP%s%d", userId, common.GetRandomString(6), time.Now().Unix())
	returnTo := service.NormalizeInternalReturnTo(req.ReturnTo, "/console/topup")
	title := fmt.Sprintf("订阅购买 %s", plan.Title)

	order := &model.SubscriptionOrder{
		UserId:        userId,
		PlanId:        plan.Id,
		Money:         plan.PriceAmount,
		TradeNo:       tradeNo,
		PaymentMethod: service.PaymentMethodAlipayF2F,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	qrCode, providerPayload, err := createAlipayOrderPayload(c, tradeNo, service.AlipaySceneSubscription, title, plan.PriceAmount, returnTo)
	if err != nil {
		order.Status = common.TopUpStatusFailed
		order.CompleteTime = common.GetTimestamp()
		_ = order.Update()
		common.ApiErrorMsg(c, err.Error())
		return
	}

	order.ProviderPayload = providerPayload
	if err := order.Update(); err != nil {
		common.ApiErrorMsg(c, "保存支付信息失败")
		return
	}

	common.ApiSuccess(c, gin.H{
		"trade_no":         tradeNo,
		"payment_page_url": service.BuildAlipayPaymentPageURL(tradeNo, returnTo, service.ResolveRequestBaseURL(c.Request)),
		"qr_code":          qrCode,
	})
}

func GetAlipayOrderDetail(c *gin.Context) {
	tradeNo := strings.TrimSpace(c.Param("trade_no"))
	if tradeNo == "" {
		common.ApiErrorMsg(c, "订单号不能为空")
		return
	}

	userId := c.GetInt("id")
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	resp, err := getAlipayOrderDetailForUser(c, tradeNo, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, resp)
}

func AlipayNotify(c *gin.Context) {
	if err := c.Request.ParseForm(); err != nil {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	params := make(map[string]string, len(c.Request.PostForm))
	for key := range c.Request.PostForm {
		params[key] = c.Request.PostForm.Get(key)
	}
	if err := service.VerifyAlipayNotification(params); err != nil {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	tradeNo := strings.TrimSpace(params["out_trade_no"])
	if tradeNo == "" {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	tradeStatus := strings.TrimSpace(params["trade_status"])
	switch {
	case service.IsAlipayTradeSuccess(tradeStatus):
		if err := completeAlipayOrder(tradeNo, params, nil); err != nil {
			_, _ = c.Writer.Write([]byte("fail"))
			return
		}
	case service.IsAlipayTradeExpired(tradeStatus):
		_ = expireAlipayOrder(tradeNo, params)
	}

	_, _ = c.Writer.Write([]byte("success"))
}

func createAlipayOrderPayload(c *gin.Context, tradeNo string, scene string, title string, amount float64, returnTo string) (string, string, error) {
	ctx, cancel := contextWithRequest(c)
	defer cancel()

	precreateResult, err := service.AlipayF2FPrecreate(ctx, &service.AlipayPrecreateArgs{
		TradeNo:     tradeNo,
		Subject:     title,
		TotalAmount: amount,
		NotifyURL:   service.GetAlipayF2FNotifyURL(),
	})
	if err != nil {
		return "", "", fmt.Errorf("拉起支付宝当面付失败")
	}

	expiresAt := time.Now().Add(5 * time.Minute).Unix()
	providerPayload := service.MergeAlipayOrderPayload("", &service.AlipayOrderPayload{
		Scene:     scene,
		Title:     title,
		QRCode:    precreateResult.QRCode,
		ReturnTo:  returnTo,
		ExpiresAt: expiresAt,
	})
	return precreateResult.QRCode, providerPayload, nil
}

func getAlipayOrderDetailForUser(c *gin.Context, tradeNo string, userId int) (*AlipayOrderDetailResponse, error) {
	if topUp := model.GetTopUpByTradeNo(tradeNo); topUp != nil && topUp.UserId == userId && topUp.PaymentMethod == service.PaymentMethodAlipayF2F {
		if err := syncAlipayTopUpStatus(c, topUp); err != nil {
			return nil, err
		}
		topUp = model.GetTopUpByTradeNo(tradeNo)
		if topUp == nil {
			return nil, fmt.Errorf("订单不存在")
		}
		payload := service.ParseAlipayOrderPayload(topUp.ProviderPayload)
		return &AlipayOrderDetailResponse{
			TradeNo:     tradeNo,
			Scene:       service.AlipaySceneTopUp,
			Title:       payload.Title,
			QRCode:      payload.QRCode,
			Status:      topUp.Status,
			Amount:      topUp.Money,
			ExpiresAt:   payload.ExpiresAt,
			ReturnTo:    service.NormalizeInternalReturnTo(payload.ReturnTo, queryReturnTo(c)),
			TradeStatus: getTradeStatusFromPayload(payload),
		}, nil
	}

	order := model.GetSubscriptionOrderByTradeNo(tradeNo)
	if order == nil || order.UserId != userId || order.PaymentMethod != service.PaymentMethodAlipayF2F {
		return nil, fmt.Errorf("订单不存在")
	}
	if err := syncAlipaySubscriptionStatus(c, order); err != nil {
		return nil, err
	}
	order = model.GetSubscriptionOrderByTradeNo(tradeNo)
	if order == nil {
		return nil, fmt.Errorf("订单不存在")
	}
	payload := service.ParseAlipayOrderPayload(order.ProviderPayload)
	return &AlipayOrderDetailResponse{
		TradeNo:     tradeNo,
		Scene:       service.AlipaySceneSubscription,
		Title:       payload.Title,
		QRCode:      payload.QRCode,
		Status:      order.Status,
		Amount:      order.Money,
		ExpiresAt:   payload.ExpiresAt,
		ReturnTo:    service.NormalizeInternalReturnTo(payload.ReturnTo, queryReturnTo(c)),
		TradeStatus: getTradeStatusFromPayload(payload),
	}, nil
}

func syncAlipayTopUpStatus(c *gin.Context, topUp *model.TopUp) error {
	if topUp == nil || topUp.Status != common.TopUpStatusPending {
		return nil
	}

	payload := service.ParseAlipayOrderPayload(topUp.ProviderPayload)
	queryResult, queryPayload, err := queryAlipayTrade(c, topUp.TradeNo)
	if err == nil && queryResult != nil {
		switch {
		case service.IsAlipayTradeSuccess(queryResult.TradeStatus):
			merged := service.MergeAlipayOrderPayload(topUp.ProviderPayload, &service.AlipayOrderPayload{QueryPayload: queryPayload})
			return model.RechargeAlipayF2F(topUp.TradeNo, merged)
		case service.IsAlipayTradeExpired(queryResult.TradeStatus):
			return expireAlipayTopUp(topUp, &payload, queryPayload)
		}
	}
	if payload.ExpiresAt > 0 && time.Now().Unix() > payload.ExpiresAt {
		return expireAlipayTopUp(topUp, &payload, queryPayload)
	}
	return nil
}

func syncAlipaySubscriptionStatus(c *gin.Context, order *model.SubscriptionOrder) error {
	if order == nil || order.Status != common.TopUpStatusPending {
		return nil
	}

	payload := service.ParseAlipayOrderPayload(order.ProviderPayload)
	queryResult, queryPayload, err := queryAlipayTrade(c, order.TradeNo)
	if err == nil && queryResult != nil {
		switch {
		case service.IsAlipayTradeSuccess(queryResult.TradeStatus):
			merged := service.MergeAlipayOrderPayload(order.ProviderPayload, &service.AlipayOrderPayload{QueryPayload: queryPayload})
			return model.CompleteSubscriptionOrder(order.TradeNo, merged)
		case service.IsAlipayTradeExpired(queryResult.TradeStatus):
			return expireAlipaySubscription(order, &payload, queryPayload)
		}
	}
	if payload.ExpiresAt > 0 && time.Now().Unix() > payload.ExpiresAt {
		return expireAlipaySubscription(order, &payload, queryPayload)
	}
	return nil
}

func queryAlipayTrade(c *gin.Context, tradeNo string) (*service.AlipayTradeQueryResult, map[string]any, error) {
	ctx, cancel := contextWithRequest(c)
	defer cancel()

	result, err := service.AlipayF2FQuery(ctx, tradeNo)
	if err != nil {
		return nil, nil, err
	}
	queryPayload := map[string]any{
		"out_trade_no": result.TradeNo,
		"trade_no":     result.UpstreamTradeNo,
		"trade_status": result.TradeStatus,
		"total_amount": result.TotalAmount,
	}
	return result, queryPayload, nil
}

func completeAlipayOrder(tradeNo string, notifyPayload map[string]string, queryPayload map[string]any) error {
	if order := model.GetSubscriptionOrderByTradeNo(tradeNo); order != nil && order.PaymentMethod == service.PaymentMethodAlipayF2F {
		merged := service.MergeAlipayOrderPayload(order.ProviderPayload, &service.AlipayOrderPayload{
			NotifyPayload: notifyPayload,
			QueryPayload:  queryPayload,
		})
		return model.CompleteSubscriptionOrder(tradeNo, merged)
	}

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.PaymentMethod != service.PaymentMethodAlipayF2F {
		return fmt.Errorf("订单不存在")
	}
	merged := service.MergeAlipayOrderPayload(topUp.ProviderPayload, &service.AlipayOrderPayload{
		NotifyPayload: notifyPayload,
		QueryPayload:  queryPayload,
	})
	return model.RechargeAlipayF2F(tradeNo, merged)
}

func expireAlipayOrder(tradeNo string, notifyPayload map[string]string) error {
	if order := model.GetSubscriptionOrderByTradeNo(tradeNo); order != nil && order.PaymentMethod == service.PaymentMethodAlipayF2F {
		payload := service.ParseAlipayOrderPayload(order.ProviderPayload)
		payload.NotifyPayload = notifyPayload
		return expireAlipaySubscription(order, &payload, nil)
	}

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.PaymentMethod != service.PaymentMethodAlipayF2F {
		return fmt.Errorf("订单不存在")
	}
	payload := service.ParseAlipayOrderPayload(topUp.ProviderPayload)
	payload.NotifyPayload = notifyPayload
	return expireAlipayTopUp(topUp, &payload, nil)
}

func expireAlipayTopUp(topUp *model.TopUp, payload *service.AlipayOrderPayload, queryPayload map[string]any) error {
	if topUp == nil || topUp.Status != common.TopUpStatusPending {
		return nil
	}
	if payload != nil && queryPayload != nil {
		payload.QueryPayload = queryPayload
	}
	if payload != nil {
		topUp.ProviderPayload = service.MergeAlipayOrderPayload(topUp.ProviderPayload, payload)
	}
	topUp.Status = common.TopUpStatusExpired
	topUp.CompleteTime = common.GetTimestamp()
	return topUp.Update()
}

func expireAlipaySubscription(order *model.SubscriptionOrder, payload *service.AlipayOrderPayload, queryPayload map[string]any) error {
	if order == nil || order.Status != common.TopUpStatusPending {
		return nil
	}
	if payload != nil && queryPayload != nil {
		payload.QueryPayload = queryPayload
	}
	if payload != nil {
		order.ProviderPayload = service.MergeAlipayOrderPayload(order.ProviderPayload, payload)
	}
	order.Status = common.TopUpStatusExpired
	order.CompleteTime = common.GetTimestamp()
	return order.Update()
}

func getTradeStatusFromPayload(payload service.AlipayOrderPayload) string {
	if payload.QueryPayload != nil {
		if tradeStatus, ok := payload.QueryPayload["trade_status"].(string); ok {
			return tradeStatus
		}
	}
	if payload.NotifyPayload != nil {
		return payload.NotifyPayload["trade_status"]
	}
	return ""
}

func queryReturnTo(c *gin.Context) string {
	return service.NormalizeInternalReturnTo(c.Query("return_to"), "/console/topup")
}

func contextWithRequest(c *gin.Context) (context.Context, context.CancelFunc) {
	if c != nil && c.Request != nil {
		return context.WithTimeout(c.Request.Context(), 15*time.Second)
	}
	return context.WithTimeout(context.Background(), 15*time.Second)
}
