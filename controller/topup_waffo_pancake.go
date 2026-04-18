package controller

import (
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/thanhpk/randstr"
)

type WaffoPancakePayRequest struct {
	Amount int64 `json:"amount"`
}

func RequestWaffoPancakeAmount(c *gin.Context) {
	var req WaffoPancakePayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	if req.Amount < int64(setting.WaffoPancakeMinTopUp) {
		c.JSON(200, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", setting.WaffoPancakeMinTopUp)})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	payMoney := getWaffoPancakePayMoney(req.Amount, group)
	if payMoney <= 0.01 {
		c.JSON(200, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	c.JSON(200, gin.H{"message": "success", "data": fmt.Sprintf("%.2f", payMoney)})
}

func getWaffoPancakePayMoney(amount int64, group string) float64 {
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

	payMoney := dAmount.
		Mul(decimal.NewFromFloat(setting.WaffoPancakeUnitPrice)).
		Mul(decimal.NewFromFloat(topupGroupRatio)).
		Mul(decimal.NewFromFloat(discount))

	return payMoney.InexactFloat64()
}

func normalizeWaffoPancakeTopUpAmount(amount int64) int64 {
	if operation_setting.GetQuotaDisplayType() != operation_setting.QuotaDisplayTypeTokens {
		return amount
	}

	normalized := decimal.NewFromInt(amount).
		Div(decimal.NewFromFloat(common.QuotaPerUnit)).
		IntPart()
	if normalized < 1 {
		return 1
	}
	return normalized
}

func waffoPancakeMoneyToMinorUnits(payMoney float64) int64 {
	return decimal.NewFromFloat(payMoney).
		Mul(decimal.NewFromInt(100)).
		Round(0).
		IntPart()
}

func getWaffoPancakeBuyerEmail(user *model.User) string {
	if user != nil && strings.TrimSpace(user.Email) != "" {
		return user.Email
	}
	if user != nil {
		return fmt.Sprintf("%d@new-api.local", user.Id)
	}
	return ""
}

func getWaffoPancakeReturnURL() string {
	if strings.TrimSpace(setting.WaffoPancakeReturnURL) != "" {
		return setting.WaffoPancakeReturnURL
	}
	return strings.TrimRight(system_setting.ServerAddress, "/") + "/console/topup?show_history=true"
}

func RequestWaffoPancakePay(c *gin.Context) {
	if !setting.WaffoPancakeEnabled {
		c.JSON(200, gin.H{"message": "error", "data": "Waffo Pancake 支付未启用"})
		return
	}
	currentWebhookKey := setting.WaffoPancakeWebhookPublicKey
	if setting.WaffoPancakeSandbox {
		currentWebhookKey = setting.WaffoPancakeWebhookTestKey
	}
	if strings.TrimSpace(setting.WaffoPancakeMerchantID) == "" ||
		strings.TrimSpace(setting.WaffoPancakePrivateKey) == "" ||
		strings.TrimSpace(currentWebhookKey) == "" ||
		strings.TrimSpace(setting.WaffoPancakeStoreID) == "" ||
		strings.TrimSpace(setting.WaffoPancakeProductID) == "" {
		c.JSON(200, gin.H{"message": "error", "data": "Waffo Pancake 配置不完整"})
		return
	}

	var req WaffoPancakePayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < int64(setting.WaffoPancakeMinTopUp) {
		c.JSON(200, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", setting.WaffoPancakeMinTopUp)})
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		c.JSON(200, gin.H{"message": "error", "data": "用户不存在"})
		return
	}

	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	payMoney := getWaffoPancakePayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(200, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	tradeNo := fmt.Sprintf("WAFFO_PANCAKE-%d-%d-%s", id, time.Now().UnixMilli(), randstr.String(6))
	topUp := &model.TopUp{
		UserId:        id,
		Amount:        normalizeWaffoPancakeTopUpAmount(req.Amount),
		Money:         payMoney,
		TradeNo:       tradeNo,
		PaymentMethod: model.PaymentMethodWaffoPancake,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		log.Printf("create Waffo Pancake topup failed: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	expiresInSeconds := 45 * 60
	session, err := service.CreateWaffoPancakeCheckoutSession(c.Request.Context(), &service.WaffoPancakeCreateSessionParams{
		StoreID:     setting.WaffoPancakeStoreID,
		ProductID:   setting.WaffoPancakeProductID,
		ProductType: "onetime",
		Currency:    strings.ToUpper(strings.TrimSpace(setting.WaffoPancakeCurrency)),
		PriceSnapshot: &service.WaffoPancakePriceSnapshot{
			Amount:      fmt.Sprintf("%d", waffoPancakeMoneyToMinorUnits(payMoney)),
			TaxIncluded: false,
			TaxCategory: "saas",
		},
		BuyerEmail:       getWaffoPancakeBuyerEmail(user),
		SuccessURL:       getWaffoPancakeReturnURL(),
		ExpiresInSeconds: &expiresInSeconds,
	})
	if err != nil {
		log.Printf("create Waffo Pancake checkout session failed: %v", err)
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(200, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	c.JSON(200, gin.H{
		"message": "success",
		"data": gin.H{
			"checkout_url": session.CheckoutURL,
			"session_id":   session.SessionID,
			"expires_at":   session.ExpiresAt,
			"order_id":     tradeNo,
		},
	})
}

func WaffoPancakeWebhook(c *gin.Context) {
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Printf("read Waffo Pancake webhook body failed: %v", err)
		c.String(400, "bad request")
		return
	}

	signature := c.GetHeader("X-Waffo-Signature")

	event, err := service.VerifyConfiguredWaffoPancakeWebhook(string(bodyBytes), signature)
	if err != nil {
		log.Printf("verify Waffo Pancake webhook failed: %v", err)
		c.String(401, "invalid signature")
		return
	}

	if event.NormalizedEventType() != "order.completed" {
		c.String(200, "OK")
		return
	}

	tradeNo, err := service.ResolveWaffoPancakeTradeNo(event)
	if err != nil {
		log.Printf("Waffo Pancake webhook resolve trade no failed: %v, event=%s, order_id=%s", err, event.ID, event.Data.OrderID)
		c.String(200, "OK")
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	if err := model.RechargeWaffoPancake(tradeNo); err != nil {
		log.Printf("Waffo Pancake recharge failed: %v, trade_no=%s", err, tradeNo)
		c.String(500, "retry")
		return
	}

	c.String(200, "OK")
}
